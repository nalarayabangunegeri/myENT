# DEPLOY Produksi (VPS + Docker + Caddy)

## 1. Siapkan VPS + DNS

Arahkan `API_URL` dan `ADMIN_URL` (lihat `.env.prod.example`) ke IP VPS.
Buka port 80/443. Caddy mengurus HTTPS otomatis (Let's Encrypt).

## 2. Jalankan

```bash
cp .env.prod.example .env.prod   # isi semua, JANGAN commit
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
curl https://API_URL/health   # {"ok":true}
```

`api` otomatis `migrate deploy` saat start (entrypoint). Cek log:
`docker compose ... logs -f api`.

## 3. Seed admin pertama + ganti password

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec \
  -e SEED_ADMIN_NIM=... -e SEED_ADMIN_PASSWORD='...' api \
  bun apps/api/prisma/seed.ts
```

Login di Web Admin → langsung ganti password sementara.

## 4. Backup harian (cron di host)

Database:

```bash
0 2 * * * cd /srv/myENT && DATABASE_URL='postgresql://USER:PASS@localhost:5432/DB?schema=public' bash scripts/backup.sh /srv/backup/jurnalistik-$(date +\%F).sql
```

File upload (driver `local` — pg_dump TIDAK mencakupnya):

```bash
15 2 * * * docker run --rm -v myent_uploads:/u -v /srv/backup:/b alpine tar czf /b/uploads-$(date +\%F).tgz -C /u .
```

(Nama volume: `docker volume ls | grep uploads` untuk memastikan.)
Restore: `psql "$DATABASE_URL_BERSIH" < backup.sql` (lihat `scripts/backup.sh`).

## 5. Rollout bertahap 150 anggota

1. **Pengurus (5–10 orang):** satu kegiatan uji [SECURITY_DATA] rekap + export benar.
2. **Satu divisi:** import CSV divisi itu, presensi serentak (uji beban wifi kampus), kumpulkan keluhan 1 minggu.
3. **Semua:** import CSV penuh, umumkan + pasang pengumuman in-app; siapkan 1 admin standby reset password
   (tanpa SMTP, reset manual oleh pengurus — prioritaskan isi SMTP agar mandiri).

Kriteria lanjut tahap: presensi sukses >95%, nol 500 di log API, rekap cocok hitung manual.

## 5. Update

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

## 6. Mobile menunjuk API prod

```bash
flutter build apk --release --dart-define=API_URL=https://API_URL
```

Firebase: tambah `google-services.json` (Android) dari console FCM agar push hidup.
