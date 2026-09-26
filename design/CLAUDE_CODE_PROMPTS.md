# Build prompts for Claude Code

Unzip this folder into an empty project directory, open a terminal there and run `claude`. Paste one prompt at a time. Review, run the app, and commit before moving on.

**0. Kickoff**
> Read README.md and CLAUDE_CODE_PROMPTS.md. Serve `prototype/` and look at every screen. Write a CLAUDE.md summarizing the stack, conventions and the business rules from the README. Then propose the folder structure. Don't write app code yet.

**1. Foundation**
> Scaffold Next.js + TypeScript + Tailwind + Prisma + PostgreSQL (docker-compose for local Postgres). Configure Tailwind with the README design tokens and Hanken Grotesk. Implement the full Prisma schema from the README, a migration, and a seed script that ports the sample data from `prototype/fpv-data-v2.js`. Add Auth.js with the five roles and route protection. Build the app shell (sidebar, header, login) matching the prototype.

**2. Domain rules + tests**
> Implement the README business rules as pure functions in `lib/domain/`: health, payment status derivation, PO totals, stockout risk, budget utilization and customs estimate. Write Vitest tests covering every branch, using the prototype's sample orders as fixtures, e.g. RC-26096 → Delayed "Balance overdue since Sep 20".

**3. Suppliers, brands, products, budgets**
> Build CRUD + screens for Suppliers (cards + performance tab), Supplier Detail, Brand Budgets and Products. Enforce role permissions server-side.

**4. Purchase orders**
> Build the All Purchase Orders screen with all filters and search, the PO Detail page and the 5-step Create PO wizard with budget check. Every mutation writes ActivityLog and recalculates health.

**5. Payments, production, shipments, customs, documents**
> Add Record Payment (with receipt upload to S3/R2 via presigned URLs), production updates, shipment + milestones, customs checklist + costs, partial/full receiving that updates stock, and the Documents screen.

**6. Dashboard, inventory, calendar, analytics**
> Build the Dashboard, Incoming Inventory, Calendar and Analytics screens from real queries, matching the prototype pixel-close.

**7. Notifications + jobs**
> Implement the notification rules, the Action Center and the header popover. Add a daily cron that recalculates health/overdue/delayed and creates notifications. Add an email digest via Resend.

**8. Hardening**
> Add Playwright tests for: login → create PO → record payment → receive goods. Add rate limiting, audit logging, error monitoring (Sentry) and CSV export. Build a one-off Excel/CSV import script for suppliers, products and open POs.

**9. Deploy**
> Option A: deploy to Vercel with Neon Postgres, R2 storage, Vercel Cron and a custom domain. Option B: write a production docker-compose (app, postgres, caddy with automatic HTTPS, nightly pg_dump to object storage) and a deploy guide for an Ubuntu VPS. Document the environment variables.
