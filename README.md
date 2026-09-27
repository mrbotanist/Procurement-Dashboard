# FPV Procurement Hub

Procurement management app for an FPV drone store: purchase orders, payments, production, shipments, customs, receiving, brand budgets and supplier performance in one place.

It runs on your own computer. The app, the database and uploaded files all stay on that machine.

## What you need

- **Node.js 22 LTS**: https://nodejs.org
- **Git**: https://git-scm.com (only needed to download and update the app)
- **Docker Desktop**: https://www.docker.com/products/docker-desktop — runs the PostgreSQL database. It must be open whenever you use the app.
  (Alternatively install PostgreSQL 16 yourself and set `DATABASE_URL` in `.env`.)

## Hosting online (VPS)

To run it on a server with its own web address and HTTPS instead of your PC, follow
**[docs/DEPLOY-VULTR.md](docs/DEPLOY-VULTR.md)** (works on any Ubuntu VPS). It uses Docker for the
app, database, HTTPS and nightly backups.

## First-time setup

### Windows (easiest)

1. `git clone https://github.com/mrbotanist/Procurement-Dashboard.git`
2. Open Docker Desktop and wait until it says it is running.
3. In the `Procurement-Dashboard` folder, double-click **`setup-windows.bat`**.
4. Double-click **`start-windows.bat`** and open http://localhost:3000.

If PowerShell says *running scripts is disabled*, run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

### Any system (commands, one at a time)

```
npm install
npm run setup          # creates .env with a random AUTH_SECRET
docker compose up -d   # starts PostgreSQL
npm run db:deploy      # creates the tables
npm run db:seed        # loads the sample data (first time only!)
npm run build
npm start              # http://localhost:3000
```

## Every day

- Windows: open Docker Desktop, then double-click `start-windows.bat`. Keep its window open; press Ctrl+C there to stop.
- Otherwise: `docker compose up -d` then `npm start`.

Other devices on the same Wi-Fi can use it at `http://<this computer's IP>:3000` (for example `http://192.168.1.20:3000`). Don't expose port 3000 to the internet.

## Updating to a new version

Stop the app, then double-click `update-windows.bat`, or run:

```
git pull
npm install
npm run db:deploy
npm run build
```

## Sample accounts

`npm run db:seed` creates one user per role, all with the password `procurement`:

| Email | Role | Can |
|---|---|---|
| admin@fpvstore.ae | Admin | everything, users, budgets |
| rashid.khan@fpvstore.ae | Procurement Manager | POs, suppliers, products, payments, shipments, documents |
| finance@fpvstore.ae | Finance | view all, record payments |
| warehouse@fpvstore.ae | Warehouse | view POs/shipments, receive goods, stock counts |
| management@fpvstore.ae | Management | read-only, analytics |

Before real use: sign in as admin, open **Settings**, add your team, and deactivate the sample users (or change their passwords via **My account** — click your name in the sidebar).

**`npm run db:seed` wipes all data.** Only run it on a fresh install.

## Starting with your own data

Either create suppliers, products and POs in the app, or import them from Excel/CSV:

```
npm run import -- suppliers  my-suppliers.xlsx
npm run import -- products   my-products.xlsx
npm run import -- pos        my-open-orders.xlsx
```

Templates and column descriptions are in [`import-templates/`](import-templates/README.md). Add `--dry-run` to check a file first.

To start from an **empty database** instead of the samples (this deletes everything):

```
npm run db:fresh
npm run create-admin -- --email you@yourstore.ae --name "Your Name" --password "a long password"
```

Then sign in, add your team under Settings, set brand budgets, and import or create suppliers and products.

## Two-step sign-in (email codes)

After the password, users can be asked for a 6-digit code sent to their email. Add to `.env` and restart the app:

```
SMTP_URL="smtp://USER:PASSWORD@smtp.yourprovider.com:587"
MAIL_FROM="FPV Procurement Hub <procurement@yourstore.ae>"
TWO_FACTOR="all"            # or only some roles: "ADMIN,FINANCE"
```

Check email first with `npm run mail:test -- you@yourstore.ae`. To try it without an email account, use
`SMTP_URL="console"`: codes are then written to `logs/mail.log`. If email breaks and nobody can sign in, set
`TWO_FACTOR="off"` and restart. **Settings** shows whether it is on. More detail in
[docs/DEPLOY-VULTR.md](docs/DEPLOY-VULTR.md#email-and-two-step-sign-in-recommended).

## What runs automatically

- **Daily check** at 00:05 (Asia/Dubai) and a few seconds after the app starts: marks overdue payments and late production, recalculates every order's health, creates notifications (delayed, overdue, due tomorrow, unconfirmed after 48 h, customs documents missing, arriving within 2 days) and clears ones that no longer apply. Run it by hand with `npm run jobs:daily`.
- **Email digest** (optional): with `SMTP_URL` set, emails open critical/attention items to admins, managers, finance and management each night.
- **Error log**: server errors are written to `logs/errors.log`.

## Backups

Everything important is in the database and the `storage/` folder (uploaded files).

```
docker compose exec postgres pg_dump -U fpv fpv_procurement > backup.sql
```

Copy `backup.sql` and the `storage/` folder somewhere safe (another drive or cloud folder), ideally daily. Restore into an empty database with:

```
docker compose exec -T postgres psql -U fpv fpv_procurement < backup.sql
```

## Troubleshooting

| Message | Fix |
|---|---|
| Can't reach database server | Docker Desktop isn't running. Open it, then `docker compose up -d`. |
| port 5432 is already in use | Another PostgreSQL is running. Stop it, or change the port in `docker-compose.yml` and `DATABASE_URL`. |
| port 3000 is already in use | `PORT=3001 npm start` (PowerShell: `$env:PORT=3001; npm start`). |
| Too many sign-in attempts | Wait 15 minutes, or restart the app. |
| Sign-in code never arrives | Check spam, run `npm run mail:test -- you@yourstore.ae`, or set `TWO_FACTOR="off"` and restart. |
| Something went wrong | Check `logs/errors.log` and the terminal window. |

## For developers

| Command | What it does |
|---|---|
| `npm run dev` | Development server with live reload |
| `npm test` | Unit tests for the business rules (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright; needs a seeded database, reseed afterwards) |
| `npm run lint` / `npm run typecheck` | Code checks |
| `npm run db:migrate -- --name x` | New migration after editing `prisma/schema.prisma` |
| `npm run db:studio` | Browse the database |

`CLAUDE.md` describes the stack, conventions, business rules and folder layout. `design/` holds the original design handoff and HTML prototype.
