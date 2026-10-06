# DECISIONS.md

## Package manager: Bun (2026-10-05)
- Perintah: `bun install`, `bun --filter api <lint|test|build|seed>`. Jangan pakai npm.
- `bunx` dilarang untuk CLI prisma (pernah menyuntik `@prisma/client@7` ke root); pakai bin workspace `apps/api/node_modules/.bin/prisma`.
- Seed jalan di runtime Bun native (`bun prisma/seed.ts`); `ts-node` dibuang.

## M0 Fondasi (2026-10-05)
- Monorepo npm workspaces (bukan pnpm — pnpm tidak tersedia di env; script AGENTS §2 disesuaikan).
- Hanya `apps/api` di M0; `admin`/`mobile` menyusul tahapnya (YAGNI, PRD §24).
- Refresh token disimpan sha256 (stdlib crypto), bukan bcrypt — token acak panjang, cukup hash satu arah.
- `@prisma/client` + `prisma` dipin `6.19.3` eksak: hoisted v7 merusak runtime client hasil generate v6.
- Login throttle in-memory (single instance); upgrade ke shared store saat multi-instance.
- Rate limit + audit dasar masuk M0 (PRD §6.3); CSV import di M1.

## M1 Anggota & Meeting (2026-10-05)
- CHECK waktu (`start<end`, `open<close`) via migration SQL manual — Prisma tak mendukung CHECK.
- Status manual hanya PUBLISHED/CANCELLED; ONGOING/COMPLETED milik job `setInterval` in-process.
- Import CSV via JSON body (tanpa multipart/multer); parser split manual maks 100 baris.
- Guard "hapus meeting yg sudah ada attendance" menyusul M2 (model belum ada); soft delete tetap.
- Tidak ada endpoint DELETE user — keluar = INACTIVE (PRD §7).

## M2 Presensi (2026-10-05)
- Dep baru: `sharp` (re-encode buang EXIF, PRD §10), `@aws-sdk/client-s3` + presigner (R2).
- `STORAGE_DRIVER=local|r2`; smoke pakai local. Jalur R2 ditulis tapi belum live-test — butuh kredensial R2.
- File yatim dihapus saat DB gagal (termasuk retry 409 dengan key baru).
- PRESENT-menang atas PENDING menyusul M3 (model AbsenceRequest belum ada).

## M3 Request & Penyesuaian (2026-10-05)
- `BR-18` via partial unique index SQL manual (PENDING/APPROVED).
- Lampiran: foto/PDF ≤5MB via JSON-less multipart (tanpa multer tambahan — bawaan platform-express).
- Approve transaksional; PRESENT→409; PENDING saat close jadi ABSENT lalu approve membalik ke mapped.

## M4 Auto Alpha & Rekap (2026-10-05)
- Finalize menumpang tick meeting (satu interval); per meeting satu transaksi + `skipDuplicates`.
- Rekap dihitung saat dibaca (satu fungsi §14.1); rekap pengurus agregasi in-memory + allowlist sort.
- Mapping & status efektif masih konstanta kode; pindah ke halaman konfigurasi di P1 (PRD §15.8).

## M5 Hardening & Pilot (2026-10-05)
- Retensi menumpang tick meeting; batch 100; objek dihapus dulu (lokal: unlink gagal = throw, bukan silent).
- Header keamanan tanpa lib (nosniff/DENY/no-referrer); seed menolak default di production.
- `scripts/backup.sh` mengupas `?schema=` (pg_dump tak menerimanya). Drill: dump→restore db2→login+rekap OK.
- Pilot kegiatan nyata lulus: CSV import→reset→presensi→approve→finalize→rekap konsisten.

## P1 Pendukung (2026-10-05)
- Push FCM best-effort (lazy init; tanpa kredensial = skip, in-app tetap tersimpan).
- Pengumuman = fan-out baris notifikasi per anggota aktif (query inbox sederhana).
- Reminder dibuka/hampir-ditutup via flag di Meeting + tick; export cap 5000 baris.
- Submission tanpa kolom status (diturunkan: REVIEWED>LATE>SUBMITTED).
- Reset via email: selalu 200; tanpa SMTP hanya log di non-prod. Butuh SMTP + WEB_URL di prod.
- Dep baru: exceljs, pdfkit, qrcode, firebase-admin, nodemailer.

## P2 Enhancement (2026-10-05)
- QR: token HMAC exp 5 mnt, generate per request; window+selfie tetap berlaku.
- Lokasi: lat/lng/radius opsional per meeting; haversine murni; hanya saat presensi.
- Poin: dihitung saat dibaca (hadir+10, tugas+10, alpha−5); tanpa model baru.
- Integrasi kalender eksternal ditunda (butuh pilihan: Google OAuth vs feed iCal).

## Backend gaps + Web Admin (2026-10-05)
- E2E vertikal (`apps/api/test/`, supertest + DB nyata) hijau di lokal; CI menjalankan test + test:e2e.
- Rate limit sensitif via middleware (60/mnt/IP: /auth, POST attendance/absence).
- Tick dijaga advisory lock (aman multi-instance); pesan log [meeting-tick] jika gagal.
- Admin Next.js BFF: token di cookie httpOnly (SameSite Lax), proxy + refresh diam-diam, cek Origin untuk mutasi.
- Halaman: login (+wajib ganti), dashboard, kegiatan (+detail approval/bulk/adjust), anggota (+CSV), rekap (+XLSX), materi, tugas (+review), audit (+XLSX), konfigurasi.

## Backlog §22.3 (2026-10-06)
- Recurring WEEKLY (anak DRAFT, stop di count); kuota semester (default off); threshold flag di rekap.
- Klaim koreksi: window buka → 400; approve → MANUAL PRESENT + audit.
- Analitik read-only (officer); ICS feed gantikan integrasi penuh; foto profil tetap tidak.
- Officer scope se-divisi (kecuali ADMIN); tanpa self-approval.
- Bug penting tertangkap smoke: `86400_1000` (=10 hari!) di 5 titik — refresh token, retention, kalender, recurring. Konstanta `DAY_MS` + regression test.

## Fix batch pra-mobile (2026-10-06)
- `/health` (tanpa auth); CORS default tertutup; boot production menolak secret lemah.
- Retention juga membersihkan sesi basi + token reset; timing oracle login ditutup (DUMMY_HASH).
- Duplikat menyalin lokasi+recurrence (seri sendiri); resubmit setelah review diaudit.
- Poin/dashboard hanya finalized; flag `X-Truncated` + `truncated` analitik; klaim bisa bawa bukti.
- Upload `files: 1`; mobile: permission Manifest, scan QR, kumpul tugas (PDF/foto), buka materi via URL; PDF rekap mobile diskip (butuh auth header).
- Admin: pengumuman, analitik+poin, QR+lokasi+koreksi di detail kegiatan.
- Tunda: versi API `/v1` (saat breaking change pertama), kredensial R2/FCM/SMTP + uji live.

## Empat fitur susulan (2026-10-06)
- 2FA TOTP stdlib (tanpa dep; otplib v13 ESM-only tak jalan di Jest) + lockout dipakai ulang untuk brute-force kode.
- Pengumuman target divisi + angkatan (fan-out saat kirim).
- Maintenance log barang (created/updated/returned/damaged) + endpoint riwayat.
- Officer scope se-divisi di list + decide + adjust + histori meeting; tanpa self-approval.
- UI: 2FA di profil + login (admin & mobile), filter angkatan, riwayat barang.

## Rollout 150 anggota (2026-10-06)
- Throttle dua ember (IP 600 + user 60/mnt) agar wifi kampus tak saling blokir; sub JWT hanya kunci.
- Volume `uploads` + cron tar (pg_dump tak mencakup file); rencana rollout bertahap di DEPLOY.md.
- Satu VPS kecil cukup (beban presensi trivial); SMTP disarankan agar reset mandiri.

## Deploy (2026-10-06)
- `docker-compose.prod.yml` + Caddy HTTPS + `docs/DEPLOY.md` + `.env.prod.example`.
- Image API: oven/bun (openssl ditambah untuk Prisma); entrypoint migrate-dulu.
- Image Admin: install via Bun, build+jalan di Node standalone (layout terverifikasi lokal).
- Image BELUM pernah di-build (tanpa docker di sini) — build pertama di VPS, ikuti DEPLOY.md.

## UX lengkap (2026-10-06)
- Admin: logout + profil/ganti-password, Pager di 4 list, Empty/Err, hapus kegiatan, halaman pengumuman/analitik.
- Mobile: ganti + lupa password, tab Kumpulanku, share PDF rekap, empty + pull-refresh, file_picker v13 API baru.
- flutter analyze BERSIH (dart fix), APK rebuild OK.
- AGENTS §2 diperbarui ke perintah Bun yang sebenarnya.

## Mobile Flutter (2026-10-05)
- Tanpa state-management lib (StatefulWidget + Api singleton cukup untuk CRUD display).
- Model = Map (bukan kelas) kecuali perlu; helper murni + unit test (retry, WIB, label).
- Kamera via image_picker source camera + kompres 80%; foto lokal disimpan sampai sukses.
- Token secure storage; FCM lazy (tanpa google-services tetap jalan).
- API_URL via --dart-define (emulator default 10.0.2.2); APK debug terbukti build.
- Belum diuji di device fisik (butuh HP + google-services.json untuk push).

## Piket & inventaris (2026-10-06)
- Piket = Meeting.isDuty + DutyAssignment; rekap/analitik/poin mengecualikan duty.
- Roster giliran round-robin (nim asc), anak DRAFT; izin mevcut berlaku untuk piket.
- Loan: snapshot identitas, foto awal+akhir wajib, 1 aktif/barang (partial unique),
  maks/anggota (config 2), overdue+reminder via tick, foto ikut retensi.
- UI: admin inventaris + piket; mobile tab Pinjam + ringkasan piket di Riwayat.

## Batch saran eksternal (2026-10-06)
- Deep-link notif (refType/refId → tab) + channel Android presensi/info; FCM data payload.
- BIWEEKLY (interval 14d); monthly-tanggal-N ditolak (zona waktu/Feb30) sampai ada kebutuhan.
- Export rekap + filter periode; kolom kustom ditolak (format baku melindungi pengurus).
- Silent data + halaman perangkat-login ditunda (tanpa kebutuhan).

## Gamifikasi ringan P3 (2026-10-06)
- Streak + 4 badge dihitung saat dibaca (tanpa model): streak_7, clean_month, tasker_5, duty_star_5.
- Terlihat di Profil mobile; leaderboard tak berubah.
