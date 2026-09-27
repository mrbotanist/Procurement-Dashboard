#!/bin/sh
# Nightly backup of the database and uploaded files into ./backups on the server.
# Keeps KEEP_DAYS days (default 14). Runs inside the postgres image (see docker-compose.prod.yml).
set -eu
KEEP_DAYS="${KEEP_DAYS:-14}"
backup() {
  stamp=$(date +%Y-%m-%d_%H%M)
  pg_dump -h db -U fpv fpv_procurement | gzip > "/backups/db_$stamp.sql.gz"
  tar -czf "/backups/files_$stamp.tar.gz" -C /uploads .
  find /backups -name 'db_*.sql.gz' -mtime +"$KEEP_DAYS" -delete
  find /backups -name 'files_*.tar.gz' -mtime +"$KEEP_DAYS" -delete
  echo "[backup] $stamp done"
}
until pg_isready -h db -U fpv >/dev/null 2>&1; do sleep 5; done
# One-off backup: docker compose -f docker-compose.prod.yml exec backup sh /backup.sh now
if [ "${1:-}" = "now" ]; then backup; exit 0; fi
echo "[backup] nightly backups at 02:30 into ./backups"
while true; do
  # Sleep until 02:30 server time, then back up.
  now=$(date +%s)
  next=$(date -d "$(date +%Y-%m-%d) 02:30" +%s 2>/dev/null || echo $((now + 86400)))
  [ "$next" -le "$now" ] && next=$((next + 86400))
  sleep $((next - now))
  backup
done
