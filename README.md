# FPV Procurement Hub

Procurement management app for an FPV drone store: purchase orders, payments, production, shipments, customs, receiving, brand budgets and supplier performance in one place.

It runs on your own computer. The app, the database and uploaded files all stay on that machine.

## What you need

- **Node.js 22** (or 20.19+): https://nodejs.org
- **PostgreSQL 16**, either:
  - **Docker Desktop** (easiest): https://www.docker.com/products/docker-desktop, then use the included `docker-compose.yml`, or
  - a normal PostgreSQL install (https://www.postgresql.org/download/). Create a user `fpv` with password `fpv` and a database `fpv_procurement`, or change `DATABASE_URL` in `.env` to match yours.

## First-time setup

```bash
npm install
cp .env.example .env          # Windows: copy .env.example .env
npx auth secret               # writes AUTH_SECRET into .env.local; or paste any long random string into AUTH_SECRET in .env
docker compose up -d          # starts PostgreSQL (skip if you installed it yourself)
npm run db:deploy             # creates the tables
npm run db:seed               # loads the sample data
```

## Running it

```bash
npm run build
npm start                     # http://localhost:3000
```

For development with live reload use `npm run dev` instead.

To open it from other devices on the same Wi-Fi/office network, find this computer's local IP address (for example `192.168.1.20`) and browse to `http://192.168.1.20:3000`. Keep it on your local network; don't expose that port to the internet.

## Sample accounts

`npm run db:seed` creates one user per role. The password for all of them is `procurement` (set `SEED_PASSWORD` in `.env` before seeding to change it).

| Email | Role |
|---|---|
| admin@fpvstore.ae | Admin |
| rashid.khan@fpvstore.ae | Procurement Manager |
| finance@fpvstore.ae | Finance |
| warehouse@fpvstore.ae | Warehouse |
| management@fpvstore.ae | Management |

`npm run db:seed` **wipes all data** and reloads the samples. Don't run it once you have real data.

## Backups

Your data lives in PostgreSQL (and uploaded files in `./storage` once uploads exist). Back up the database with:

```bash
docker compose exec postgres pg_dump -U fpv fpv_procurement > backup-$(date +%F).sql
```

Restore into an empty database with `psql -U fpv fpv_procurement < backup-YYYY-MM-DD.sql`.

## Other commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server with live reload |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` / `npm run typecheck` | Code checks |
| `npm run db:migrate` | Create/apply a migration after changing `prisma/schema.prisma` (development) |
| `npm run db:deploy` | Apply existing migrations (use after pulling updates) |
| `npm run db:studio` | Browse the database in the browser |

## Project docs

- `CLAUDE.md`: stack, conventions, business rules and folder layout.
- `design/`: the design handoff (spec, build plan, HTML prototype).
