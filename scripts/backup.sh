#!/usr/bin/env bash
# Backup PostgreSQL harian (PRD §18) + uploads driver local. Dipakai manual/lokal;
# cron prod lewat `exec` container, lihat docs/DEPLOY.md §4 (retensi sama: 7 hari).
#   DATABASE_URL=... [BACKUP_DIR=./backup] [KEEP_DAYS=7] [UPLOAD_DIR=./uploads] bash scripts/backup.sh
#   Restore: gunzip -c backup-YYYYMMDD.sql.gz | psql "$DATABASE_URL_BERSIH"
set -euo pipefail
: "${DATABASE_URL:?isi DATABASE_URL dulu}"
DIR="${BACKUP_DIR:-./backup}"
KEEP="${KEEP_DAYS:-7}"
UPLOADS="${UPLOAD_DIR:-./uploads}"
STAMP="$(date +%Y%m%d)"
mkdir -p "$DIR"
# pg_dump tak menerima query param ala Prisma (?schema=...); kupas dulu.
CLEAN_URL="${DATABASE_URL%%\?*}"
OUT="$DIR/backup-$STAMP.sql.gz"
pg_dump "$CLEAN_URL" | gzip > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
# Driver local: pg_dump TIDAK mencakup file upload — arsipkan volume/dir-nya.
if [ -d "$UPLOADS" ]; then
  tar czf "$DIR/uploads-$STAMP.tgz" -C "$UPLOADS" .
fi
find "$DIR" -maxdepth 1 -name 'backup-*.sql.gz' -mtime +"$KEEP" -delete
find "$DIR" -maxdepth 1 -name 'uploads-*.tgz' -mtime +"$KEEP" -delete
echo "backup -> $OUT"
