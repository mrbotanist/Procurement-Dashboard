#!/usr/bin/env bash
# First deploy (and safe to re-run):  bash deploy/deploy.sh procurement.yourdomain.com
# Creates .env with random secrets on the first run, then builds and starts everything.
set -euo pipefail
cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.prod.yml"

if [ ! -f .env ]; then
  DOMAIN="${1:-}"
  if [ -z "$DOMAIN" ]; then
    read -rp "Domain for the app (e.g. procurement.yourstore.ae): " DOMAIN
  fi
  if [ -z "$DOMAIN" ]; then echo "A domain is required."; exit 1; fi
  rand() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 40; }
  cat > .env <<ENV
DOMAIN="$DOMAIN"
POSTGRES_PASSWORD="$(rand)"
AUTH_SECRET="$(rand)"
APP_TIMEZONE="Asia/Dubai"
BACKUP_KEEP_DAYS=14
# SMTP_URL="smtp://user:password@smtp.example.com:587"
# DIGEST_FROM="FPV Procurement Hub <procurement@yourstore.ae>"
ENV
  chmod 600 .env
  echo "Created .env for $DOMAIN (keep this file safe; it holds the database password)."
fi

mkdir -p backups
echo "== Building and starting (the first build takes a few minutes)"
$COMPOSE up -d --build
$COMPOSE ps

DOMAIN=$(grep -E '^DOMAIN=' .env | cut -d'"' -f2)
echo
echo "Done. Open https://$DOMAIN"
echo "If this is a new install, create your admin account:"
echo "  $COMPOSE exec app npm run create-admin -- --email you@yourstore.ae --name \"Your Name\" --password \"a long password\""
