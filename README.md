# JURNALISTIK APP — Platform Absensi UKM Jurnalistik

Presensi selfie (+QR) + izin/sakit + alpha otomatis + rekap, plus materi, tugas
+ submission, inventaris + pinjaman, piket, koreksi kehadiran, 2FA TOTP opsional,
reset via email, notifikasi in-app (+push FCM opsional), kalender ICS, poin
keaktifan — dengan Web Admin + Mobile. Backend monolith modular (NestJS),
PostgreSQL + Prisma, storage S3-compatible (Cloudflare R2 / lokal untuk dev).

| Dokumen | Isi |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Aturan produk (sumber kebenaran domain) |
| [`docs/AGENTS.md`](docs/AGENTS.md) | Konvensi engineering |
| [`docs/API.md`](docs/API.md) | Kontrak endpoint |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Jejak keputusan |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Deploy produksi + backup + rollout |

## Struktur

```text
apps/api/       NestJS + Prisma (auth + 2FA, users, meetings, attendance, absence,
                corrections, duty, loans, materials, assignments, notifications,
                insight/analytics/points, audit, config, storage, retention)
apps/admin/     Next.js Web Admin (BFF cookie httpOnly + proxy allowlist + refresh diam-diam)
apps/mobile/    Flutter (kamera langsung, retry tahan koneksi buruk, FCM opsional)
docs/           PRD, AGENTS, API, DECISIONS, DEPLOY (+ KURANG, PERBAIKAN: jejak hardening)
scripts/        backup.sh (backup .sql.gz + prune 7 hari)
docker-compose.yml        DB lokal
docker-compose.prod.yml   prod (db + api + admin + Caddy) + Caddyfile
```

## Prasyarat

Bun 1.3 (sejajar image Docker + CI), Node 22 (build Next), Flutter 3.x (mobile),
PostgreSQL 16, Docker (prod).

## Quickstart lokal

```bash
# 1. Database
docker compose up -d db
# atau tanpa docker: initdb + pg_ctl (lihat docs/DECISIONS.md)

# 2. Install + schema + seed
bun install
apps/api/node_modules/.bin/prisma migrate dev --config apps/api/prisma.config.ts
SEED_ADMIN_NIM=admin001 SEED_ADMIN_PASSWORD='UbahSaya123!' bun apps/api/prisma/seed.ts

# 3. Jalan (terminal masing-masing)
DATABASE_URL='postgresql://postgres:postgres@localhost:5432/jurnalistik?schema=public' \
JWT_SECRET='min-32-karakter-rahasia-dev-saja' \
STORAGE_DRIVER=local UPLOAD_DIR=./uploads \
bun --filter api start:dev          # :3000

API_URL=http://localhost:3000 bun --filter admin dev   # :3102

cd apps/mobile && flutter run --dart-define=API_URL=http://10.0.2.2:3000
# HP fisik: ganti 10.0.2.2 dengan IP LAN laptop
```

Login Web Admin: NIM admin seed (`mustChangePassword` → wajib ganti saat pertama
masuk; backend menolak semua endpoint lain sampai diganti). Tanpa `TOTP_ENC_KEY`
secret 2FA tersimpan plaintext (dev saja; prod wajib isi).

## Perintah

```bash
bun --filter api lint | bun --filter api test | bun --filter api test:e2e   # e2e butuh DATABASE_URL + Postgres nyata
bun --filter api build
bun --filter admin lint | bun --filter admin test | bun --filter admin build
flutter analyze | flutter test            # dari apps/mobile
```

Jangan pakai npm. `bunx` dilarang untuk CLI prisma (pakai bin workspace).

## Environment (API)

| Var | Default | Keterangan |
|---|---|---|
| `DATABASE_URL` | — | Wajib. `?schema=public` ala Prisma |
| `JWT_SECRET` | — | Min 32 char; boot prod menolak bila lemah |
| `TOTP_ENC_KEY` | — | Min 32 char; **wajib di prod** (enkripsi secret 2FA), dev fallback plaintext |
| `FILE_HMAC_SECRET` / `QR_HMAC_SECRET` | fallback `JWT_SECRET` | Isolasi key signed-URL file / QR (isi di prod) |
| `JWT_EXPIRES_IN` / `REFRESH_EXPIRES_DAYS` | `15m` / `14` | Umur token (refresh dirotasi + atomic) |
| `LOGIN_MAX_ATTEMPTS` / `LOGIN_LOCKOUT_MINUTES` | `5` / `15` (contoh: `4` / `60`) | Lockout DB-backed + throttle in-memory |
| `STORAGE_DRIVER` | `local` | `local` (dev) / `r2` (prod) |
| `UPLOAD_DIR` | `./uploads` | Driver lokal (di-resolve absolut) |
| `API_PUBLIC_URL` | host request | Base signed-URL lokal (isi di prod agar anti Host-poisoning) |
| `R2_*`, `FCM_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` | — | Prod (push/R2 best-effort atau skip) |
| `SMTP_*`, `WEB_URL` | — | Reset-via-email (tanpa SMTP: log di non-prod; kirim di luar tx) |
| `MEETING_TICK_MS` | `60000` | Scheduler transisi + alpha + retensi + reminder + overdue |
| `ALLOWED_ORIGINS` | — | Kosong = CORS tertutup (hanya via BFF) |
| `SEED_ADMIN_*` | — | Seed admin pertama |

Konfigurasi organisasi runtime (`PATCH /config`, ADMIN): status efektif, mapping
approval, kewajiban lampiran, retensi, batas upload, kuota semester, threshold, maks pinjaman.

## Alur inti

Member: login (gagal +1 atomik → kunci; sukses reset throttle) → `mustChangePassword`
wajib ganti (semua endpoint ditolak kecuali ganti/logout/refresh/me) → 2FA bila aktif
(5x salah = challenge hangus) → presensi selfie dalam window (timestamp server) →
duplikat 409 = sukses → retry cek `attendance/me` dulu. Izin sampai
`attendance_close_at` (lampiran bila wajib); approve = transaksi + audit + notif.
Window tutup → Auto Alpha idempotent → finalized. Rekap dihitung saat dibaca
(satu rumus). Piket = meeting khusus (di luar %). Pinjam barang = foto awal +
akhir + snapshot identitas + klaim kondisional anti double-borrow. Koreksi =
klaim → approve = adjust MANUAL + audit. Lupa password = token 1 jam via email
(anti-enumerasi, selalu 200).

## Testing

Unit API (`bun --filter api test`, 32): aturan murni + throttle-reset + enkripsi TOTP;
E2E (`test:e2e`, Postgres nyata): auth → meeting → presensi → request → lockout;
Admin (`vitest`); Flutter (`flutter test`, 7: kontrak retry + widget).
CI: generate + validate + lint + build + test + e2e (api), lint + test + build
(admin), `docker build` kedua image, `flutter analyze` + test.

## Produksi

Lihat [`docs/DEPLOY.md`](docs/DEPLOY.md): compose prod + Caddy HTTPS, seed admin,
cron backup DB + uploads, rollout bertahap 150 anggota, build APK release.
`GET /health` untuk healthcheck. Wajib isi di `.env.prod`: `JWT_SECRET`,
`TOTP_ENC_KEY`, `POSTGRES_PASSWORD` (**alfanumerik saja** — dirangkai mentah ke
`DATABASE_URL`), `API_URL`/`ADMIN_URL`, Turnstile keys. Batasan yang disadari:
single-instance default (jangan scale api >1 tanpa job migrasi one-shot),
throttle in-memory, push/email/R2 butuh kredensial.
