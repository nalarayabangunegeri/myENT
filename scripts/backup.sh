#!/usr/bin/env bash
# Backup PostgreSQL (PRD §18: minimal harian) + cara restore. Dijalankan via cron/systemd.
#   DATABASE_URL=... bash scripts/backup.sh
#   Restore: psql "$DATABASE_URL" < backup-YYYYMMDD.sql
set -euo pipefail
OUT="${1:-backup-$(date +%Y%m%d).sql}"
# pg_dump tak menerima query param ala Prisma (?schema=...); kupas dulu.
CLEAN_URL="${DATABASE_URL%%\?*}"
pg_dump "$CLEAN_URL" > "$OUT"
echo "backup -> $OUT"
