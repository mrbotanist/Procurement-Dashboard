#!/usr/bin/env bash
# Update to the latest version:  bash deploy/update.sh
# Backs up first, pulls the code, rebuilds and restarts. Database migrations run on start.
set -euo pipefail
cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.prod.yml"

echo "== Backup before updating"
$COMPOSE exec -T backup sh /backup.sh now || echo "(backup service not running; skipping)"

echo "== Getting the latest code"
git pull --ff-only

echo "== Rebuilding and restarting"
$COMPOSE up -d --build
docker image prune -f >/dev/null
$COMPOSE ps
echo "Updated."
