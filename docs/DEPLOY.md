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

Service `db` tidak publish port — backup lewat `exec` ke container (bukan `localhost:5432`):

```bash
# .env.prod sudah berisi POSTGRES_USER/POSTGRES_DB
0 2 * * * cd /srv/myENT && set -a && . ./.env.prod && set +a && docker compose -f docker-compose.prod.yml exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > /srv/backup/jurnalistik-$(date +\%F).sql && find /srv/backup -name 'jurnalistik-*.sql' -mtime +7 -delete
```

File upload (driver `local` — pg_dump TIDAK mencakupnya; driver `r2` → aktifkan versioning bucket, backup ini tak perlu):

```bash
15 2 * * * docker run --rm -v $(docker volume ls -q | grep -m1 'uploads$'):/u -v /srv/backup:/b alpine tar czf /b/uploads-$(date +\%F).tgz -C /u . && find /srv/backup -name 'uploads-*.tgz' -mtime +7 -delete
```

Restore: `psql "$DATABASE_URL_BERSIH" < backup.sql` (lihat `scripts/backup.sh`).
Uji restore berkala (PRD §18): restore ke DB kosong → login + rekap OK — catat tanggal drill di bawah.

Drill terakhir: - (isi setelah drill pertama)

## 5. Rollout bertahap 150 anggota

1. **Pengurus (5–10 orang):** satu kegiatan uji [SECURITY_DATA] rekap + export benar.
2. **Satu divisi:** import CSV divisi itu, presensi serentak (uji beban wifi kampus), kumpulkan keluhan 1 minggu.
3. **Semua:** import CSV penuh, umumkan + pasang pengumuman in-app; siapkan 1 admin standby reset password
   (tanpa SMTP, reset manual oleh pengurus — prioritaskan isi SMTP agar mandiri).

Kriteria lanjut tahap: presensi sukses >95%, nol 500 di log API, rekap cocok hitung manual.

## 5. Update + rollback

```bash
# Backup dulu (DB + uploads bila driver local), catat revisi lama:
OLD=$(git rev-parse --short HEAD)
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > /srv/backup/pre-$(date +%F)-$OLD.sql
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
curl https://API_URL/health   # {"ok":true}
```

Rollback kode (DB tak bisa mundur otomatis — restore backup bila migrasi merusak):

```bash
git checkout <revisi-lama>   # mis. $OLD
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
# bila perlu: psql "$DATABASE_URL_BERSIH" < /srv/backup/pre-....sql
```

Catatan: API browser-langsung ditolak CORS secara default (tanpa `ALLOWED_ORIGINS` di service `api`
— normal; Web Admin lewat BFF server-to-server). Isi bila butuh akses browser langsung ke API.

## 6. Mobile menunjuk API prod

```bash
flutter build apk --release --dart-define=API_URL=https://API_URL
```

Firebase: tambah `google-services.json` (Android) dari console FCM agar push hidup.
