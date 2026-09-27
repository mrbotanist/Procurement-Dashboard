#!/bin/sh
# Apply database migrations, then start the app.
set -e
npx prisma migrate deploy
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
