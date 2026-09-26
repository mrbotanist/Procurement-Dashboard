# Handoff: FPV Procurement Hub

## Overview
FPV Procurement Hub is a procurement management web app for an FPV drone store based in Dubai. The procurement team uses it to track every purchase order (PO) from quotation to stock on the shelf. That covers supplier confirmation, payments, production, shipment, customs, receiving, brand budgets and supplier performance. Core promise: **"One place to know exactly where every purchase stands."**

The job is to turn the prototype into a production web app with a real backend, database, authentication, file storage and notifications, deployed to a real server.

## About the Design Files
The files in `prototype/` are **design references built in HTML**. They show the intended look and behavior. They are not production code to copy. Recreate them in the stack below (or an equivalent the team prefers) using its normal patterns.

- Run the prototype: `cd prototype && npx serve` → open `/index.html`. It must be served over HTTP; opening the file directly will not load the screens.
- `fpv-data-v2.js` holds the sample data **and the business rules**: health calculation, stockout math, payment schedule and customs checklist. Treat it as the executable spec for the domain logic.
- `Panel *.dc.html` files are the individual screens. `index.html` is the app shell (sidebar, header, notifications, login, routing).

## Fidelity
**High fidelity.** Colors, type, spacing, radii and interactions are final. Recreate the UI pixel-close. Sample numbers are illustrative; everything must come from the database.

## Recommended Stack
- **Framework:** Next.js (App Router) + TypeScript + React Server Components where sensible
- **Styling:** Tailwind CSS configured with the tokens below (or CSS modules)
- **DB:** PostgreSQL + Prisma ORM, with migrations and a seed script built from `fpv-data-v2.js`
- **Auth:** Auth.js (email magic link or credentials) with role-based access
- **Files:** S3-compatible storage (AWS S3 / Cloudflare R2) with presigned uploads
- **Jobs:** cron (Vercel Cron or node-cron on a VPS) for daily health recalculation and due-date alerts
- **Email:** Resend (or SMTP)
- **Validation:** Zod on every API input
- **Tests:** Vitest for domain rules, Playwright for key flows
- **Hosting:** either Vercel + Neon Postgres + R2, or a VPS (Ubuntu) running Docker Compose (app, postgres, caddy for HTTPS) with nightly `pg_dump` backups

## Roles & Permissions
| Role | Can |
|---|---|
| Admin | everything, user management, settings |
| Procurement Manager | create/edit POs, suppliers, products, payments, shipments, documents, notes |
| Finance | view all; record/approve payments; view budgets |
| Warehouse | view POs/shipments; mark items received (partial or full); update stock |
| Management | read-only everything, analytics |

Every mutation writes to `activity_log` (who, what, when, before/after).

## Data Model (Prisma-style summary)
- **User** id, name, email, role, createdAt
- **Supplier** id, name, country, contactName, email, phone, website, paymentTerms, currency (default USD), shippingTerms (Incoterm + place), notes, leadTimeDays (computed), onTimeRate (computed)
- **Brand** id, name
- **BrandBudget** id, brandId, year, amountUsd
- **Product** id, sku (unique), name, brandId, category, stockQty, dailySalesRate (computed from sales or entered)
- **PurchaseOrder** id, number (e.g. `GE-26091`; prefix from supplier + sequence), supplierId, brandId, currency, orderDate, paymentTerms, incoterm, expectedProductionDate, expectedShipDate, eta, productionProgressPct, lastSupplierUpdateAt, and **independent statuses**:
  - `poStatus`: DRAFT | SENT | CONFIRMED | CLOSED | CANCELLED
  - `paymentStatus`: PENDING | PARTIALLY_PAID | PAID | OVERDUE (derived from Payment rows)
  - `productionStatus`: NOT_STARTED | IN_PRODUCTION | READY | DELAYED | COMPLETED
  - `shipmentStatus`: NOT_SHIPPED | READY_TO_SHIP | SHIPPED | IN_TRANSIT | DELIVERED
  - `customsStatus`: NOT_STARTED | DOCUMENTS_REQUIRED | IN_CLEARANCE | CLEARED | ON_HOLD
  - `inventoryStatus`: NOT_RECEIVED | PARTIALLY_RECEIVED | RECEIVED | STOCKED
  - `health`, `healthReason` (computed, stored for fast filtering)
- **POItem** id, poId, productId, qtyOrdered, qtyReceived, unitPrice, discountPct, taxPct
- **Payment** id, poId, type (DEPOSIT | BALANCE | OTHER), amount, dueDate, paidDate, method, bankReference, receiptFileId, notes
- **Shipment** id, poId, carrier, trackingNumber, trackingUrl, origin, destination, shipDate, eta, actualArrival, shippingCost, milestone (SUPPLIER | PICKED_UP | EXPORT_CUSTOMS | IN_TRANSIT | IMPORT_CUSTOMS | DELIVERED)
- **CustomsDocument** id, shipmentId, type (COMMERCIAL_INVOICE | PACKING_LIST | CERTIFICATE_OF_ORIGIN | IMPORT_DOCUMENTS | CUSTOMS_DECLARATION), status (PENDING | RECEIVED | MISSING), fileId
- **CustomsCost** shipmentId, duty, importVat, clearanceCharges
- **Document** id, poId?, supplierId?, type (QUOTATION | PROFORMA_INVOICE | PURCHASE_ORDER | COMMERCIAL_INVOICE | PACKING_LIST | PAYMENT_RECEIPT | CERTIFICATE_OF_ORIGIN | AIR_WAYBILL | BILL_OF_LADING | CUSTOMS | CORRESPONDENCE | OTHER), fileName, storageKey, size, uploadedBy, createdAt
- **ActivityLog** id, poId?, userId?, actorLabel ("Supplier" / user name), text, kind (NOTE | STATUS_CHANGE | PAYMENT | SYSTEM), createdAt
- **Notification** id, userId, tone (RED | ORANGE | BLUE), kind, title, detail, poId, resolvedAt, createdAt
- **CalendarEvent**: derived at query time from payments (due dates), POs (production dates), shipments (ship date, ETA) and customs docs. No table needed.

## Business Rules (must match prototype; see `fpv-data-v2.js`)
**Order health** (evaluate in this order; first match wins):
1. paymentStatus OVERDUE → **Delayed**, "Balance overdue since {dueDate}"
2. productionStatus DELAYED → **Delayed**, "Production past expected date"
3. customsStatus ON_HOLD → **Delayed**, "Held at customs"
4. poStatus DRAFT → **Needs Attention**, "Draft not sent to supplier"
5. poStatus SENT → **Needs Attention**, "Awaiting supplier confirmation"
6. customsStatus DOCUMENTS_REQUIRED → **Needs Attention**, "{doc} missing"
7. PARTIALLY_PAID and balance due ≤ 3 days → **Needs Attention**, "Balance due in N days"
8. otherwise → **On Track**, "ETA {eta}"

Recalculate on every PO/payment/shipment mutation **and** in a daily cron job (dates move even when data doesn't). Auto-set `paymentStatus = OVERDUE` when an unpaid payment passes its due date. Auto-set `productionStatus = DELAYED` when today > expectedProductionDate and production isn't done.

**Payment status** is derived from Payment rows: sum(paid) = 0 → PENDING (or OVERDUE if any due date has passed), 0 < paid < total → PARTIALLY_PAID, paid ≥ total → PAID.

**PO total** = Σ qty × unitPrice × (1 − discount%) × (1 + tax%).

**Stockout risk** (inventory screen): cover days = floor(stock / dailySalesRate). stockoutDate = today + cover. If stockoutDate is before the incoming ETA → **Stockout risk** (red). If within 3 days after the ETA → **Tight** (orange). Otherwise **Covered**.

**Budget:** utilized = purchased / budget. Committed = value of open POs not yet invoiced. Available = budget − purchased − committed. Flag red when (purchased + committed) / budget > 95%. The Create PO review step warns when the new PO exceeds the brand's available budget.

**Customs estimate** (when not yet assessed): duty = 5% of goods value, VAT = 5% of (value + duty), clearance = $95. Once entered, use the actual values.

**Notifications** are generated by the rules engine: delayed (red), payment overdue (red), payment due within 1 day (orange), supplier confirmation pending more than 48 h (orange), customs docs missing (orange), shipment arriving within 2 days (blue), supplier update posted (blue). Each links to its PO. They can be resolved and reopened. Optionally send an email digest.

## API (REST or server actions; Zod-validated)
- `GET /api/dashboard`: KPIs, action counts + PO refs, pipeline counts, top 8 POs by health, events in the next 10 days, monthly spend YTD, top budgets, incoming inventory
- `GET/POST /api/pos`, `GET/PATCH /api/pos/:id`; filters: health, stage, paymentStatus, shipmentStatus, supplier, brand, date range, currency, q (searches PO number, supplier, brand, SKU, product, tracking number, invoice number)
- `POST /api/pos/:id/payments`, `PATCH /api/payments/:id`
- `POST /api/pos/:id/notes`
- `POST /api/pos/:id/receive` (per-item qtyReceived → updates stock + inventoryStatus)
- `GET/POST /api/shipments`, `PATCH /api/shipments/:id`, `PATCH /api/customs-documents/:id`
- `GET/POST/PATCH /api/suppliers`, `GET /api/suppliers/:id` (with stats + monthly history)
- `GET/PUT /api/brand-budgets?year=`
- `GET /api/inventory/incoming`
- `GET /api/analytics?from&to`
- `GET /api/calendar?month=YYYY-MM`
- `POST /api/uploads/presign`, `GET /api/documents`
- `GET /api/notifications`, `PATCH /api/notifications/:id`

## Screens / Views
All screens sit inside the app shell: a **left sidebar** (252px, collapses to 72px) and a **header** (64px). Content max-width is 1480px, with 24px side padding. Cards are white, with a 1px `#e3e5e8` border, 16px radius, 20px × 22px padding and a `0 1px 2px rgba(20,22,28,.04)` shadow.

1. **Login:** two columns. Left: ink `#17181b` panel with the headline "One place to know exactly where every purchase stands." (clamp 40–84px, weight 600). Right: form (email, password, keep signed in, primary "Sign in").
2. **Dashboard:** title + subtitle. Six KPI cards (Open POs, Payment Pending, In Production, In Transit, Delayed in red, Procurement YTD), each linking to a filtered list. **Action Required** card with 4 tiles (Delayed Orders, Payments Due, Supplier Confirmation, Customs Documents), showing count, sentence, PO chips and a CTA. **Pipeline** card with 12 stages (Draft → Closed): count + blue bar + label; clicking filters the PO list. Active POs table (8 rows sorted by health) + **Coming Up** (next 10 days, color-coded by type). Bottom row: Monthly Spend bars (current month in blue), Brand Budgets (purchased + committed stacked bars), Incoming Inventory with a stockout alert.
3. **All Purchase Orders:** quick filter segment (All / Needs attention / Delayed / Payment pending / Unconfirmed / In transit, each with a count). Dropdown filters: Supplier, Brand, Payment, Shipment, Order date, Currency. Removable filter chips. Table: PO, Supplier/Brand, Ordered, Total, PO Status, Payment, Production, Shipment, Customs, ETA, Health + reason. Export CSV.
4. **PO Detail:** header (PO number, health pill + reason, meta: supplier, brand, order date, total, currency; actions: Message supplier + a context-dependent primary CTA). **Order Timeline** (Created → Confirmed → Paid → Production → Shipped → In Transit → Received, dated). Six independent status cells. Left column: Products table with totals, Payment (progress bar, schedule table, receipt, note), Shipment (info list + vertical milestone timeline). Right column: Production (progress, dates, supplier notes), Customs (checklist with "Mark received", cost breakdown), Activity (add note + log), Documents. The **Record payment** dialog records the payment, recalculates health and logs it.
5. **Create PO:** a 5-step wizard with a step bar: Supplier (card picker) → Products (catalog quick-add + editable lines: SKU, product, qty, unit price, discount %, tax %, live totals) → Commercial Terms (currency, payment terms, Incoterms, expected production/ship dates, carrier, notes) → Documents (upload quotation/PI) → Review (summary, lines, budget check). Actions: "Save as draft" or "Create & send PO". Continue stays disabled until the step is valid.
6. **Suppliers:** card grid (Open Orders, Outstanding Payment, Orders YTD, Purchase Value YTD, units, lead time, alert pill) plus a **Performance** tab (on-time % bars, with red below 85%; lead time bars; open issues).
7. **Supplier Detail:** stats row, monthly purchase history bars, current orders, supplier information list, notes, documents.
8. **Brand Budgets:** totals row, table (budget, purchased, committed, available, utilization bar, %), selected-brand side panel (cells, bar, monthly trend, open POs).
9. **Incoming Inventory:** tabs (Current stock / Incoming / Reorder alerts), a red alert banner for the worst stockout risk with "Expedite / reorder", and a table (product, SKU, stock, incoming, expected total, ETA, cover, status + reason).
10. **Shipments & Customs:** shipment list (left, selectable) + detail (milestones, tracking info, customs checklist with upload, import costs).
11. **Analytics:** 6 metrics, monthly spend bars, PO status donut, spend by supplier, lead time by supplier (red above 18 days), spend by brand, spend by category + country.
12. **Calendar:** month grid (Mon-first), prev/next/today, type filter toggles (Payment, Production, Shipment, Customs, Expected arrival); events link to their PO.
13. **Documents:** search, supplier filter, type segment with counts, file table (type chip, file, document type, PO link, supplier, date, download).
14. **Action Center:** tabs (All open / Critical / Needs attention / Updates / Resolved), notification rows (tone bar, kind, time, title, detail, Open PO, Resolve/Reopen), "Resolve all info items".

Header: search (global; typing jumps to the PO list with the query), date range segment (30 days / Quarter / YTD, hidden below 1180px), notifications bell with unresolved count + popover, and a primary "Create Purchase Order" button (shortens to "New PO" below 1180px).

## Responsive
Desktop-first. Below 1024px the sidebar becomes a drawer. Below 768px: KPI cards scroll horizontally, tables become card lists, Action Required stays at the top and PO detail sections stack. A mobile dashboard reference is in the Modernist variant (`Dashboard Directions` 1d in the source project). Apply the same structure with these light tokens.

## Design Tokens
- **Font:** Hanken Grotesk (Google Fonts) 400/500/600/700. Headings 600 with −0.02em letter-spacing. Tabular numerals for all figures.
- **Type scale:** h1 28px (detail pages 34px) · card title 17–18px · body 14–15px · meta 12.5–13px · KPI value 34px · big stats 32–36px
- **Colors:** page bg `#f4f5f7` · card `#ffffff` · subtle fill `#f7f8f9` / `#eef0f2` · border `#e3e5e8` · input border `#dcdfe3` · text `#17181b` · secondary text `#62666d` · muted `#80848b` · primary button `#17181b` (hover `#2e3035`) · focus ring `oklch(0.6 0.15 255)` · chart bars `#e3e5e8`, highlight `oklch(0.6 0.15 255)`
- **Status** (pill bg / text / dot):
  - Green (Paid, Completed, Received, On Track): `oklch(0.95 0.04 155)` / `oklch(0.45 0.11 155)` / `oklch(0.65 0.15 155)`
  - Orange (Pending, Needs Attention, Documents Required, Sent): `oklch(0.95 0.05 80)` / `oklch(0.5 0.11 65)` / `oklch(0.75 0.15 70)`
  - Red (Delayed, Overdue, On Hold): `oklch(0.95 0.035 25)` / `oklch(0.5 0.17 25)` / `oklch(0.62 0.2 25)`
  - Blue (In Production, In Transit, Shipped, Partially Paid): `oklch(0.95 0.03 255)` / `oklch(0.47 0.13 255)` / `oklch(0.6 0.15 255)`
  - Gray (Not Started, Not Shipped, Draft): `#eef0f2` / `#50535a` / `#a3a7ae`
- **Calendar types:** Payment orange · Production `oklch(0.5 0.12 300)` · Shipment blue · Customs red · Arrival green
- **Radius:** buttons/inputs 10px · cards 16px (KPI 14px) · tiles 12px · pills 99px · file chips 5px
- **Spacing:** 4 / 8 / 12 / 16 / 24 / 32px; section gap 32px; card gap 12–20px
- **Shadow:** cards `0 1px 2px rgba(20,22,28,.04)`; popovers/dialogs `0 12px 32px rgba(45,43,43,.22)`
- **Icons:** Lucide

## Assets
No images. Icons are Lucide (search, bell, plus, panel-left, menu). The brand mark is a 26px ink rounded square with a 10px white ring. Replace it with the store's logo if one exists.

## Files
- `prototype/index.html`: app shell + login + routing
- `prototype/Panel *.dc.html`: the 13 in-app screens
- `prototype/fpv-data-v2.js`: sample data, health/stockout/budget rules, view models
- `prototype/support.js`, `prototype/_ds/.../styles.css`: runtime + base stylesheet for viewing the prototype only
- `CLAUDE_CODE_PROMPTS.md`: step-by-step build prompts
