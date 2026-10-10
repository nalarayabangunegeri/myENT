# API Contract — Mobile (dan referensi Web Admin)

Base URL: `https://api…` (dev: `http://localhost:3000`). Semua waktu di API = **UTC ISO-8601**;
aplikasi mengonversi ke `Asia/Jakarta` untuk tampilan. Sumber jam presensi = **server**.

## Auth

Header: `Authorization: Bearer <accessToken>` (umur 15 mnt).Semua respons error:
`{ "statusCode": n, "message": "…" }` — produksi tanpa stack/SQL.

| Method & Path | Auth | Body | Catatan |
|---|---|---|---|
| `POST /auth/login` | — | `{ nim, password }` | → `{ accessToken, refreshToken, mustChangePassword }`. Gagal 5x → kunci 15 mnt (`LOGIN_MAX_ATTEMPTS/LOGIN_LOCKOUT_MINUTES`). Rate limit 5/mnt per NIM |
| `POST /auth/refresh` | — | `{ refreshToken }` | Rotasi: token lama hangus |
| `POST /auth/logout` | — | `{ refreshToken }` | Cabut sesi itu |
| `GET /auth/me` | login | — | Tanpa `passwordHash`. **401 `MUST_CHANGE_PASSWORD`** → wajib ganti dulu |
| `POST /auth/change-password` | login | `{ oldPassword, newPassword(min 10) }` | Mencabut semua sesi |
| `POST /auth/forgot-password` | — | `{ nim }` | Selalu 200 (anti-enumerasi); butuh email di profil + SMTP |
| `POST /auth/reset-via-email` | — | `{ token, newPassword }` | Sekali pakai, 1 jam |
| `POST /auth/2fa/setup` | login | `{ password }` | → `{ secret, otpauthUrl }` (opt-in authenticator; verifikasi password anti-takeover sesi)
| `POST /auth/2fa/enable` | login | `{ code }` | Aktif setelah kode benar |
| `POST /auth/2fa/disable` | login | `{ password }` | Matikan + hapus secret |
| `POST /auth/2fa/verify` | — | `{ pendingToken, code }` | Langkah kedua login (token 5 mnt) |
| `POST /auth/privacy-consent` | login | — | Catat persetujuan privasi selfie sekali (PRD §17); wajib sebelum presensi pertama → tanpa itu `403 PRIVACY_CONSENT_REQUIRED` |

`mustChangePassword=true` (akun baru/reset): endpoint lain 401 sampai ganti password.

## Konvensi umum

- Pagination: `?page=1&limit=20` (maks 100) → `{ page, limit, total, data }`.
- `409` = duplikat milik sendiri → **anggap sukses**, bukan error (lihat protokol retry).
- `410` = file retensi sudah dihapus (record tetap ada).
- Upload: multipart, field dibedakan per endpoint; validasi magic bytes + ukuran di server.
  Batas default 5 MB (materi 10 MB; configurable).

## Presensi (inti)

```text
POST /meetings                          → list (member: tanpa DRAFT)
POST /meetings/:id/attendance           → field `selfie` (JPG/PNG/WebP) + opsional `latitude`, `longitude`
GET  /meetings/:id/attendance/me        → status sendiri (cek sebelum retry)
GET  /attendance/me                     → riwayat sendiri (paginasi)
GET  /attendance/recap/me               → rekap + `history[]` (+`corrected`, `adjustmentReason` bila MANUAL)
GET  /attendance/recap/me.pdf           → unduhan PDF pribadi
POST /meetings/:id/attendance/qr        → field `token` + `selfie` (+ lokasi bila disyaratkan)
```

Aturan: window `attendance_open_at ≤ server_time ≤ attendance_close_at`, meeting
`PUBLISHED/ONGOING`, selfie wajib, lokasi wajib **hanya** bila kegiatan memakai radius.
Di luar window → 400 dengan pesan jelas (`sudah ditutup — hubungi pengurus`).

**Protokol koneksi buruk (wajib di mobile):** simpan foto lokal sampai sukses; timeout
eksplisit 30 dtk; retry otomatis maks 3x; **sebelum mengulang yang timeout, panggil
`attendance/me`** — sudah ada = sukses. Jangan antre offline (waktu = server).

## Izin / Sakit (`AbsenceRequest`)

```text
POST   /meetings/:id/absence-requests   → field `reasonType` (SICK|ACADEMIC|BEREAVEMENT|ORGANIZATION|DISPENSATION|OTHER),
                                          `reasonDetail`, lampiran opsional `attachment` (foto/PDF)
GET    /absence-requests/me             → daftar milik sendiri
PATCH  /absence-requests/:id/cancel     → tarik yang masih PENDING
```

Batas: sampai `attendance_close_at`; satu aktif per kegiatan (409); sudah `PRESENT` → 409.
Hasil approve: `SICK→SICK`, `DISPENSATION→DISPENSATION`, lainnya → `PERMITTED`.

## Materi, Tugas, Notifikasi, Poin, Kalender

```text
GET /materials  (+ /materials/:id/file → { url })        # URL 5 mnt, unduh cepat
GET /assignments  (+ /assignments/:id/submissions)        # submit: POST .../submissions field `file`
GET /submissions/me                                       # status: SUBMITTED | LATE | REVIEWED
GET /notifications/me (?unreadOnly)                       # + PATCH /notifications/:id/read
POST /notifications/devices  { token }                    # token FCM; push best-effort
GET /points/me  (+ /points/leaderboard khusus pengurus)  # { points, rank, streak, longestStreak, badges[] }
GET /calendar?from=&to=                                   # kegiatan + deadline tugas
```

Isi push FCM tidak memuat alasan sensitif; in-app adalah sumber kebenaran (retensi 90 hari).

## Khusus pengurus (dipakai Web Admin; didokumentasikan agar konsisten)

`POST/PATCH/DELETE /meetings` (+ `/duplicate`, window terkunci setelah finalized),
`GET /meetings/:id/attendance`, `PATCH /absence-requests/:id/approve|reject`,
`POST /absence-requests/bulk`, `POST /meetings/:id/attendance/adjust`
(`{ userId, status, reason }` — alasan wajib), `POST/GET /users` (+ `/import`, `/bulk-deactivate`),
`GET /attendance/recap?search=&sortBy=&order=` (sort allowlist),
`GET /attendance/recap/export.xlsx`, `GET /meetings/:id/qr`,
`GET /dashboard`, `GET/PATCH /config` (ADMIN; `effective_statuses` berlaku ke histori),
`GET /audit-logs` (+ `/export.xlsx` ADMIN), `POST /announcements`, `POST /assignments` (+ review),
`POST /materials`, `POST /auth/reset-password` (oleh pengurus).

Rincian domain (status, rumus, mapping): `PRD.md`. Cara engineering: `AGENTS.md`.

## Tambahan: 2FA, target pengumuman, maintenance, scope

```text
POST /announcements { title, body?, division?, cohortYear? }  # pengurus
GET  /items/:id/history        # pengurus; riwayat kondisi/status barang
GET  /users?division=          # admin saja; officer otomatis se-divisi
```

Officer scope se-divisi (kecuali ADMIN): daftar user, review request/klaim/adjust,
dan riwayat kehadiran per meeting. Review request/klaim sendiri ditolak (403).

## Piket & inventaris

```text
POST /duty/roster { startDate, days, perDay?, division? }  # pengurus; hasil DRAFT
GET  /duty/assignments/me  (+ /duty/assignments?meetingId pengurus)
GET  /duty/summary/me      # { scheduled, attended } — rekap % rapat mengecualikan piket
POST /items  PATCH /items/:id  GET /items  # pengurus; status AVAILABLE/BORROWED/MAINTENANCE
POST /loans { itemId, dueAt } + foto `photo` (awal, wajib)
POST /loans/:id/return + foto `photo` (akhir, wajib; pengurus; `damaged` → MAINTENANCE)
POST /loans/:id/cancel  GET /loans/me?page&limit  GET /loans?status&page&limit (pengurus)
→ `{ page, limit, total, data }` (dulu array mentah)
```

Aturan: satu aktif per barang (409), maks pinjaman aktif per anggota (config, default 2),
overdue + reminder H-1 otomatis, foto ikut retensi 6 bulan.

## Backlog yang sudah masuk (§22.3)

```text
POST /meetings  (+ recurrence: NONE|WEEKLY, recurrenceCount 2–52)  # anak DRAFT +7d saat finalize
POST /meetings/:id/corrections { claim }  # window tutup + belum PRESENT; approve → MANUAL PRESENT
# bukti opsional: multipart field `evidence` (foto/PDF)
GET  /corrections/me  (+ /meetings/:id/corrections pengurus, /corrections/:id/approve|reject|cancel)
GET  /analytics/trends|frequent-absentees|by-division  # pengurus
GET  /calendar.ics                                     # feed kalender
GET  /attendance/recap (+ /me) → +belowThreshold bila threshold aktif
```

Kuota izin semester (`absence_quota_per_semester`, default tanpa batas) dan ambang
kehadiran (`attendance_threshold_pct`) via `/config`. Officer hanya atas se-divisi
(kecuali ADMIN); reviewer tak boleh memutus request/klaim sendiri.
