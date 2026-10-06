# JURNALISTIK APP — Platform Absensi UKM Jurnalistik

Presensi selfie + izin/sakit + alpha otomatis + rekap, plus materi, tugas,
inventaris, piket, dan Web Admin + Mobile. Backend monolith modular (NestJS),
PostgreSQL + Prisma, storage S3-compatible (Cloudflare R2 / lokal untuk dev).

Dokumen sumber: [`docs/PRD.md`](docs/PRD.md) (aturan produk), [`docs/AGENTS.md`](docs/AGENTS.md)
(cara engineering), [`docs/API.md`](docs/API.md) (kontrak endpoint),
[`docs/DECISIONS.md`](docs/DECISIONS.md) (jejak keputusan), [`docs/DEPLOY.md`](docs/DEPLOY.md) (produksi).

## Struktur

```text
apps/api/       NestJS + Prisma (auth, users, meetings, attendance, absence,
                corrections, duty, loans, materials, assignments, notifications,
                insight/analytics/points, audit, config, storage, retention)
apps/admin/     Next.js Web Admin (BFF cookie httpOnly + proxy + refresh diam-diam)
apps/mobile/    Flutter (kamera langsung, retry tahan koneksi buruk, FCM opsional)
docs/           PRD, AGENTS, API, DECISIONS, DEPLOY
scripts/        backup.sh
docker-compose.yml        DB lokal
docker-compose.prod.yml   prod (db + api + admin + Caddy) + Caddyfile
```

## Prasyarat

Bun 1.x, Node 22 (untuk build Next), Flutter 3.x (mobile), PostgreSQL 16.

## Quickstart lokal

```bash
# 1. Database (pilih salah satu)
docker compose up -d db
# atau tanpa docker: initdb + pg_ctl (lihat docs/DECISIONS.md)

# 2. Install + schema + seed
bun install
apps/api/node_modules/.bin/prisma migrate dev --schema apps/api/prisma/schema.prisma
SEED_ADMIN_NIM=admin001 SEED_ADMIN_PASSWORD='UbahSaya123!' bun apps/api/prisma/seed.ts

# 3. Jalan (terminal masing-masing)
DATABASE_URL='postgresql://postgres:postgres@localhost:5432/jurnalistik?schema=public' \
JWT_SECRET='min-32-karakter-rahasia-dev-saja' \
STORAGE_DRIVER=local UPLOAD_DIR=./uploads \
bun --filter api start:dev          # :3100

API_URL=http://localhost:3100 bun --filter admin dev   # :3102

cd apps/mobile && flutter run --dart-define=API_URL=http://10.0.2.2:3100
# HP fisik: ganti 10.0.2.2 dengan IP LAN laptop
```

Login Web Admin: NIM admin seed (`must_change_password` → wajib ganti saat pertama masuk).

## Perintah

```bash
bun --filter api lint | bun --filter api test | bun --filter api test:e2e   # e2e butuh DATABASE_URL
bun --filter api build
bun --filter admin lint | bun --filter admin build
flutter analyze | flutter test            # dari apps/mobile
```

Jangan pakai npm. `bunx` dilarang untuk CLI prisma (pakai bin workspace).

## Environment (API)

| Var | Default | Keterangan |
|---|---|---|
| `DATABASE_URL` | — | Wajib. `?schema=public` ala Prisma |
| `JWT_SECRET` | — | Min 32 char; wajib di production (boot menolak bila lemah) |
| `JWT_EXPIRES_IN` / `REFRESH_EXPIRES_DAYS` | `15m` / `14` | Umur token |
| `LOGIN_MAX_ATTEMPTS` / `LOGIN_LOCKOUT_MINUTES` | `5` / `15` | Lockout DB-backed |
| `STORAGE_DRIVER` | `local` | `local` (dev) / `r2` (prod) |
| `UPLOAD_DIR` | `./uploads` | Driver lokal |
| `R2_*`, `FCM_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` | — | Prod (push/email/R2 best-effort atau skip) |
| `SMTP_*`, `WEB_URL` | — | Reset-via-email (tanpa SMTP: log di non-prod) |
| `MEETING_TICK_MS` | `60000` | Scheduler transisi + alpha + retensi + reminder |
| `ALLOWED_ORIGINS` | — | Kosong = CORS tertutup |
| `SEED_ADMIN_*` | — | Seed admin pertama |

Konfigurasi organisasi runtime (`PATCH /config`, ADMIN): status efektif, mapping
approval, kewajiban lampiran, retensi, batas upload, kuota semester, threshold, maks pinjaman.

## Alur inti

Member: login → presensi selfie dalam window (timestamp server) → duplikat 409 =
sukses → retry cek `attendance/me` dulu. Izin sampai `attendance_close_at`;
approve = transaksi + audit. Window tutup → Auto Alpha idempotent → finalized.
Rekap dihitung saat dibaca (satu rumus). Piket = meeting khusus (di luar %).
Pinjam barang = foto awal + akhir + snapshot identitas.

## Testing

Unit (`bun --filter api test`, 27) untuk aturan murni; E2E vertikal
(`test:e2e`, supertest + Postgres nyata) untuk auth → meeting → presensi →
request → lockout + modul baru; Flutter (`flutter test`) untuk kontrak retry;
CI menjalankan semuanya + build admin.

## Produksi

Lihat [`docs/DEPLOY.md`](docs/DEPLOY.md): compose prod + Caddy HTTPS, seed admin,
cron backup DB + uploads, rollout bertahap 150 anggota, build APK release.
`GET /health` untuk healthcheck. Batasan yang disadari: single-instance default
(lock advisory siap multi-instance), throttle in-memory, push/email/R2 butuh kredensial.
