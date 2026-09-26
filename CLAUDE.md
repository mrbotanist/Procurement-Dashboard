@AGENTS.md

# FPV Procurement Hub

Procurement management web app for an FPV drone store in Dubai. It tracks every purchase order (PO) from quotation to stock on the shelf: supplier confirmation, payments, production, shipment, customs, receiving, brand budgets and supplier performance.

Product promise: **"One place to know exactly where every purchase stands."**

## Source of truth

- `design/README.md`: full spec (data model, business rules, API, screens, tokens). Read it before changing domain logic or UI.
- `design/CLAUDE_CODE_PROMPTS.md`: the build plan, steps 0 to 9. Work one step at a time.
- `design/prototype/`: high-fidelity HTML prototype. It is a **reference, not code to copy**.
  - `fpv-data-v2.js` is the executable spec for domain rules (health, stockout, payment schedule, customs checklist) and the seed data.
  - `Panel *.dc.html` are the 13 in-app screens; `index.html` is the shell (sidebar, header, login, notifications, routing).
  - Run it: `cd design/prototype && npx serve`, then open `/index.html` (must be served over HTTP). It loads React and Babel from unpkg, so it needs internet access.
- "Today" in the sample data is **2026-09-26**. Tests and seed fixtures use that date via an injectable clock.

## Stack

- Next.js 16 (App Router) + TypeScript (strict). Server Components by default; client components only for interactivity. Next 16 renamed middleware to `src/proxy.ts`; read `node_modules/next/dist/docs/` before using an API you're unsure of.
- Tailwind CSS 4. Design tokens live in `src/app/globals.css` (`@theme`), plus a few component classes (`.btn`, `.input`, `.card`, `.seg`, `.field`). Font: Hanken Grotesk, self-hosted via `@fontsource-variable/hanken-grotesk` (works offline).
- PostgreSQL 16 + Prisma 7 (`prisma-client` generator → `src/generated/prisma`, `@prisma/adapter-pg`, config in `prisma.config.ts`). Seed ported from `fpv-data-v2.js`.
- Auth.js v5 (next-auth beta), credentials provider (email + bcrypt password), JWT sessions. Five roles; permissions in `src/lib/auth/permissions.ts`.
- Zod on every API/server-action input.
- Tests: Vitest for domain rules, Playwright for key flows.
- Icons: `lucide-react`.

## Hosting: local machine

The app is hosted **locally** for now (no cloud server). Build for that:
- Database: PostgreSQL via `docker-compose.yml` or a native install. `DATABASE_URL` in `.env`.
- Files: uploads go to local disk under `STORAGE_DIR` (default `./storage`, git-ignored) behind a small storage interface (`src/lib/storage.ts`, step 5), so S3/R2 can be swapped in later. Serve downloads through an authenticated route, never from `public/`.
- Jobs: the daily health/notification job runs in-process with `node-cron`, started from `src/instrumentation.ts` (step 7), plus an `npm` script to run it by hand. Also recalc on app start in case the machine was off at the scheduled time.
- Email: none for now; notifications are in-app. Keep the digest behind an optional SMTP setting.
- Runs with `npm run build && npm start` on port 3000; `AUTH_TRUST_HOST=true` is required outside Vercel.

## Conventions

- **Domain logic lives in `src/lib/domain/` as pure functions.** No Prisma, no `Date.now()` inside: pass `today` in. UI and API call these; never re-implement a rule in a component.
- **Every mutation** goes through a service in `src/server/services/` that: validates with Zod, checks role permission, writes the change, writes `ActivityLog` (who, what, when, before/after), and recalculates PO health. Do all of that in one Prisma transaction.
- Store money as `Decimal` in the DB. Format only at the edge (`src/lib/format.ts`: `usd`, `usdR`, `usdK`, `fmt` "Sep 28").
- Dates: store `DateTime` in UTC; treat business dates (due dates, ETAs) as date-only values in Asia/Dubai.
- Status enums in the DB are SCREAMING_SNAKE (`PARTIALLY_PAID`). Map to display labels ("Partially Paid") and tones in one place (`src/lib/status.ts`).
- Health and healthReason are computed, then **stored** on `PurchaseOrder` for fast filtering. Never edit them directly.
- Permissions are checked on the server (services/route handlers). Hiding a button in the UI is not a permission check.
- Use tabular numerals for every figure.
- Commit after each build step. Keep PRs to one step.

## Roles

| Role | Can |
|---|---|
| ADMIN | everything, user management, settings |
| PROCUREMENT_MANAGER | create/edit POs, suppliers, products, payments, shipments, documents, notes |
| FINANCE | view all; record/approve payments; view budgets |
| WAREHOUSE | view POs/shipments; mark items received (partial or full); update stock |
| MANAGEMENT | read-only everything, analytics |

## Business rules (must match the prototype)

**PO statuses are independent**: `poStatus`, `paymentStatus`, `productionStatus`, `shipmentStatus`, `customsStatus`, `inventoryStatus`. Plus computed `health` + `healthReason`.

**Order health**, evaluated in order, first match wins:
1. paymentStatus OVERDUE → Delayed, "Balance overdue since {dueDate}"
2. productionStatus DELAYED → Delayed, "Production past expected date"
3. customsStatus ON_HOLD → Delayed, "Held at customs"
4. poStatus DRAFT → Needs Attention, "Draft not sent to supplier"
5. poStatus SENT → Needs Attention, "Awaiting supplier confirmation"
6. customsStatus DOCUMENTS_REQUIRED → Needs Attention, "{doc} missing" (use the actual missing doc; the prototype hardcodes "Certificate of origin")
7. PARTIALLY_PAID and balance due ≤ 3 days → Needs Attention, "Balance due in N days"
8. otherwise → On Track, "ETA {eta}" (or "Progressing to plan" with no ETA)

Health sort order for lists: Delayed, Needs Attention, On Track, then ETA ascending (no ETA last).

Recalculate on every PO/payment/shipment mutation **and** in the daily cron. The cron also sets `paymentStatus = OVERDUE` when an unpaid payment passes its due date, and `productionStatus = DELAYED` when today > expectedProductionDate and production isn't done.

**Payment status** from Payment rows: paid = 0 → PENDING (OVERDUE if any due date has passed); 0 < paid < total → PARTIALLY_PAID; paid ≥ total → PAID.

**PO total** = Σ qty × unitPrice × (1 − discount%) × (1 + tax%).

**Stockout risk**: cover = floor(stock / dailySalesRate); stockoutDate = today + cover; gap = days(stockoutDate → ETA). gap > 0 → **Stockout risk** (red, "Stockout ~{date}, {gap} days before arrival"); −3 < gap ≤ 0 → **Tight** (orange, "Tight: cover ends {date}"); else **Covered**.

**Budget**: utilized = purchased / budget. Committed = open POs not yet invoiced. Available = budget − purchased − committed. Red when (purchased + committed) / budget > 95%. Create PO review warns when the new PO exceeds the brand's available budget.

**Customs estimate** (until actuals are entered): duty = 5% of goods value; VAT = 5% of (value + duty); clearance = $95. Label estimates "(est.)".

**Notifications** from the rules engine: delayed (red), payment overdue (red), payment due within 1 day (orange), supplier confirmation pending > 48 h (orange), customs docs missing (orange), shipment arriving within 2 days (blue), supplier update posted (blue). Each links to its PO; can be resolved and reopened.

**PO number**: supplier prefix + sequence, e.g. `GE-26091`.

## Design tokens

- Page bg `#f4f5f7` · card `#ffffff` · subtle fill `#f7f8f9` / `#eef0f2` · border `#e3e5e8` · input border `#dcdfe3`
- Text `#17181b` · secondary `#62666d` · muted `#80848b` · primary button `#17181b` (hover `#2e3035`) · focus ring `oklch(0.6 0.15 255)`
- Chart bars `#e3e5e8`, highlight `oklch(0.6 0.15 255)`
- Status tones (bg / text / dot):
  - green `oklch(0.95 0.04 155)` / `oklch(0.45 0.11 155)` / `oklch(0.65 0.15 155)`: Paid, Completed, Ready, Received, Stocked, Delivered, Cleared, Confirmed, On Track
  - orange `oklch(0.95 0.05 80)` / `oklch(0.5 0.11 65)` / `oklch(0.75 0.15 70)`: Pending, Sent, Documents Required, Needs Attention
  - red `oklch(0.95 0.035 25)` / `oklch(0.5 0.17 25)` / `oklch(0.62 0.2 25)`: Delayed, Overdue, On Hold
  - blue `oklch(0.95 0.03 255)` / `oklch(0.47 0.13 255)` / `oklch(0.6 0.15 255)`: Partially Paid, In Production, Ready to Ship, Shipped, In Transit, In Clearance, Partially Received
  - gray `#eef0f2` / `#50535a` / `#a3a7ae`: Not Started, Not Shipped, Not Received, Draft, Closed, Cancelled
- Calendar: Payment orange · Production `oklch(0.5 0.12 300)` · Shipment blue · Customs red · Arrival green
- Radius: buttons/inputs 10px · cards 16px (KPI 14px) · tiles 12px · pills 99px · file chips 5px
- Spacing 4/8/12/16/24/32; section gap 32px; card gap 12–20px
- Shadows: card `0 1px 2px rgba(20,22,28,.04)`; popover/dialog `0 12px 32px rgba(45,43,43,.22)`
- Type: h1 28px (detail 34px), card title 17–18px, body 14–15px, meta 12.5–13px, KPI 34px. Headings weight 600, letter-spacing −0.02em.
- Layout: sidebar 252px (collapsed 72px), header 64px, content max-width 1480px, 24px side padding. Cards: 1px border, 16px radius, 20px × 22px padding.
- Responsive: < 1024px sidebar becomes a drawer; < 768px KPI cards scroll horizontally, tables become card lists, PO detail sections stack. Header date range hides and "Create Purchase Order" shortens to "New PO" below 1180px.

## Folder structure

```
design/                      handoff: spec, build prompts, HTML prototype (reference only)
prisma/
  schema.prisma
  migrations/
  seed.ts                    ported from design/prototype/fpv-data-v2.js
src/
  app/
    (auth)/login/            login page
    (app)/                   authenticated shell: sidebar + header
      layout.tsx
      page.tsx               dashboard
      orders/                list, [id] detail, new (5-step wizard)
      suppliers/             list + performance tab, [id] detail
      budgets/
      inventory/
      shipments/
      analytics/
      calendar/
      documents/
      actions/               action center
      settings/              users (admin)
    api/                     route handlers (REST from the README), cron endpoint, auth
  components/
    ui/                      primitives: Button, Card, Pill/StatusBadge, Segment, Select, Dialog, Table, ProgressBar
    shell/                   Sidebar, Header, NotificationsPopover, GlobalSearch
    charts/                  BarChart, StackedBar, Donut, Timeline
    <feature>/               screen-specific components (orders/, po-detail/, create-po/, ...)
  lib/
    domain/                  pure rules: health, payment-status, totals, stockout, budget, customs, notifications, calendar
    domain/__tests__/        Vitest, fixtures from prototype sample POs
    status.ts                enum → label + tone mapping
    format.ts                money/date formatting
    validation/              Zod schemas shared by API and forms
    auth/                    Auth.js config, role → permission map, requireRole()
    db.ts                    Prisma client singleton
    storage.ts               file storage (local disk now; S3/R2 later)
  generated/prisma/          Prisma client (generated, git-ignored)
  proxy.ts                   signed-out visitors → /login
  auth.ts                    Auth.js config
  server/
    services/                mutations: transaction + permission + ActivityLog + health recalc
    queries/                 read models for each screen (dashboard, orders, analytics, ...)
    jobs/                    daily recalculation, notification generation, email digest
tests/e2e/                   Playwright
docker-compose.yml           local Postgres
prisma.config.ts             Prisma CLI config (datasource URL, seed command)
```

## Commands

- `npm run dev` / `npm run build` / `npm start`
- `npm test` (Vitest), `npm run lint`, `npm run typecheck`
- `npm run db:migrate` (new migration after schema change), `npm run db:deploy`, `npm run db:seed` (wipes + reloads sample data), `npm run db:reset`, `npm run db:studio`
- After changing `prisma/schema.prisma`: `npm run db:migrate -- --name <change>`, then `npx prisma generate` (Prisma 7 migrate does not regenerate the client).

Before committing: `npm run typecheck && npm run lint && npm test && npm run build`.

Seeded users (password `procurement`): admin@, rashid.khan@, finance@, warehouse@, management@ fpvstore.ae.
