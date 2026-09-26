import type { Metadata } from "next";
import Link from "next/link";
import { BarChart, StackedBar } from "@/components/ui/Bars";
import { Card } from "@/components/ui/Card";
import { Page } from "@/components/ui/PageHeader";
import { HealthDot, Pill } from "@/components/ui/Pill";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { fromIsoDate, todayIso } from "@/lib/dates";
import { STAGES } from "@/lib/domain/orders";
import { fmtDate, MON, MONL, usd, usdK } from "@/lib/format";
import { poLabels } from "@/lib/status";
import { dashboard } from "@/server/queries/insights";
import type { PoSummary } from "@/server/queries/pos";

export const metadata: Metadata = { title: "Dashboard" };

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EV_COLOR: Record<string, string> = {
  Payment: "bg-ev-payment",
  Production: "bg-ev-production",
  Shipment: "bg-ev-shipment",
  Customs: "bg-ev-customs",
  Arrival: "bg-ev-arrival",
};

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const user = await requirePermission("view:dashboard");
  const { range } = await searchParams;
  const today = todayIso();
  const d = await dashboard(today, typeof range === "string" ? range : undefined);
  const showMoney = can(user.role, "view:analytics");
  const date = fromIsoDate(today);

  const kpis = [
    { label: "Open POs", value: d.kpis.open, sub: d.kpis.drafts ? `Active orders · ${d.kpis.drafts} drafts` : "Active purchase orders", dot: "bg-ink", href: "/orders" },
    { label: "Payment Pending", value: d.kpis.paymentPending.length, sub: "Orders awaiting payment", dot: "bg-orange-dot", href: "/orders?f=payment" },
    { label: "In Production", value: d.kpis.production.length, sub: "Orders currently being manufactured", dot: "bg-blue-dot", href: "/orders?f=production" },
    { label: "In Transit", value: d.kpis.transit.length, sub: "Shipments currently moving", dot: "bg-blue-dot", href: "/shipments" },
    { label: "Delayed", value: d.kpis.delayed.length, sub: "Orders requiring attention", dot: "bg-red-dot", href: "/orders?f=delayed", red: true },
    ...(showMoney ? [{ label: d.range.key === "ytd" ? "Procurement YTD" : `Procurement · ${d.range.label}`, value: usdK(d.kpis.spend), sub: d.range.key === "ytd" ? "Total procurement this year" : `Since ${fmtDate(d.range.from)}`, dot: "bg-ink", href: "/analytics" }] : []),
  ];

  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const tiles = [
    { title: "Delayed Orders", tone: "red", list: d.actions.delayed, desc: `${d.actions.delayed.length} ${plural(d.actions.delayed.length, "purchase order is", "purchase orders are")} past an expected date or payment.`, cta: "View Orders", href: "/orders?f=delayed" },
    { title: "Payments Due", tone: "orange", list: d.actions.payment, desc: `${d.actions.payment.length} supplier ${plural(d.actions.payment.length, "payment is", "payments are")} pending.`, cta: "Review Payments", href: "/orders?f=payment" },
    { title: "Supplier Confirmation", tone: "orange", list: d.actions.unconfirmed, desc: `${d.actions.unconfirmed.length} ${plural(d.actions.unconfirmed.length, "purchase order has", "purchase orders have")} not been confirmed by suppliers.`, cta: "Review Orders", href: "/orders?f=unconfirmed" },
    { title: "Customs Documents", tone: "orange", list: d.actions.customs, desc: `${d.actions.customs.length} ${plural(d.actions.customs.length, "shipment is", "shipments are")} awaiting required customs documentation.`, cta: "View Shipments", href: "/shipments" },
  ] as const;
  const actionTotal = tiles.reduce((s, t) => s + t.list.length, 0);

  const grouped = new Map<string, typeof d.events>();
  for (const e of d.events) grouped.set(e.date, [...(grouped.get(e.date) ?? []), e]);
  const maxStage = Math.max(1, ...STAGES.slice(0, 10).map((s) => d.stages[s]));

  return (
    <Page className="gap-8!">
      <div className="order-first flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[28px]">Procurement Dashboard</h1>
          <p className="text-[15px] text-secondary">Overview of purchasing activity, payments, shipments and incoming inventory.</p>
        </div>
        <span className="text-[13px] text-secondary">
          {date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}, {MONL[date.getUTCMonth()]} {date.getUTCDate()}, {date.getUTCFullYear()}
        </span>
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:overflow-visible md:px-0 md:pb-0" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="flex min-w-[170px] flex-col gap-1.5 rounded-kpi border border-line bg-white px-[18px] py-4 shadow-card hover:border-neutral-400">
            <span className="flex items-center gap-2 text-[13px] leading-tight whitespace-nowrap text-secondary">
              <span className={`size-2 rounded-full ${k.dot}`} />
              {k.label}
            </span>
            <span className={`text-[34px] leading-none font-semibold tracking-[-0.02em] ${"red" in k && k.red && k.value ? "text-accent" : ""}`}>{k.value}</span>
            <span className="text-[13px] text-secondary">{k.sub}</span>
          </Link>
        ))}
      </div>

      <section className="card order-first md:order-none">
        <div className="flex flex-wrap items-end justify-between gap-4 pb-3">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg">Action Required</h2>
              <p className="text-sm text-secondary">Items that may require your attention.</p>
            </div>
            <span className="flex h-[26px] items-center rounded-full bg-red-bg px-2.5 text-[13px] font-semibold text-red-fg">{actionTotal}</span>
          </div>
          <Link href="/actions" className="btn btn-ghost">
            Open action center →
          </Link>
        </div>
        <div className="mt-2 grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))" }}>
          {tiles.map((t) => (
            <div key={t.title} className="flex flex-col gap-2.5 rounded-tile border border-neutral-200 bg-neutral-100 px-4 py-3.5">
              <div className="flex items-center justify-between">
                <span className={`flex items-center gap-2 text-[12.5px] font-semibold ${t.tone === "red" ? "text-red-fg" : "text-orange-fg"}`}>
                  <span className={`size-2.5 rounded-full ${t.tone === "red" ? "bg-red-dot" : "bg-orange-dot"}`} />
                  {t.title}
                </span>
                <span className="text-[32px] leading-none font-semibold">{t.list.length}</span>
              </div>
              <p className="flex-1 text-[15px] leading-snug text-pretty">{t.desc}</p>
              <div className="flex flex-wrap gap-1">
                {t.list.map((p) => (
                  <Link key={p.id} href={`/orders/${p.number}`} className="rounded-md bg-neutral-200 px-1.5 py-0.5 text-xs font-semibold hover:bg-neutral-300">
                    {p.number}
                  </Link>
                ))}
              </div>
              <Link href={t.href} className="btn btn-secondary justify-between!">
                {t.cta}
                <span aria-hidden>→</span>
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="card flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg">Procurement Pipeline</h2>
            <p className="text-sm text-secondary">Active orders by stage. Select a stage to filter purchase orders.</p>
          </div>
          <span className="text-[13px] text-secondary">
            {d.openCount} open · {d.closedCount} closed this year
          </span>
        </div>
        <div className="overflow-x-auto">
          <div className="grid min-w-[980px] items-end" style={{ gridTemplateColumns: "repeat(12,minmax(80px,1fr))" }}>
            {STAGES.map((s, i) => {
              const closed = i >= 10;
              const n = d.stages[s];
              const customs = s === "Customs";
              return (
                <Link key={s} href={`/orders?stage=${encodeURIComponent(s)}`} className="flex flex-col gap-2 rounded-[10px] px-2.5 pt-2 pb-2.5 hover:bg-subtle">
                  <span className="text-[11px] text-neutral-600">{String(i + 1).padStart(2, "0")}</span>
                  <span className={`text-[30px] leading-none font-semibold tracking-[-0.02em] ${closed ? "text-neutral-600" : customs && n ? "text-orange-fg" : ""}`}>{n}</span>
                  <span className={`rounded-[5px] ${closed ? "bg-neutral-200" : customs && n ? "bg-orange-dot" : "bg-blue-dot"}`} style={{ height: Math.max(4, Math.round((Math.min(n, maxStage) / maxStage) * 28)) }} />
                  <span className={`min-h-8 text-[13px] leading-tight ${closed ? "text-neutral-600" : ""}`}>{s}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-8">
        <Card className="flex-[1_1_720px]" title="Active Purchase Orders" subtitle="Payment, production and shipment tracked separately. Sorted by health." aside={<Link href="/orders" className="btn btn-ghost">View all →</Link>}>
          <ActiveTable rows={d.active} />
        </Card>
        <Card className="flex-[1_1_320px]" title="Coming Up" subtitle="Next 10 days" aside={<Link href="/calendar" className="btn btn-ghost">Calendar →</Link>}>
          {[...grouped.entries()].slice(0, 7).map(([day, evs]) => {
            const dt = fromIsoDate(day);
            return (
              <div key={day} className="grid grid-cols-[52px_1fr] gap-3 border-b border-neutral-200 py-2.5">
                <div className="flex flex-col leading-[1.05]">
                  <span className="text-[12.5px] text-secondary">{DOW[dt.getUTCDay()]}</span>
                  <span className="text-2xl font-semibold">{dt.getUTCDate()}</span>
                  <span className="text-[11px] text-secondary">{MON[dt.getUTCMonth()]}</span>
                </div>
                <div className="flex flex-col justify-center gap-1.5">
                  {evs.map((e, i) => (
                    <Link key={i} href={`/orders/${e.poNumber}`} className="grid grid-cols-[8px_1fr_auto] items-center gap-2 text-sm hover:underline">
                      <span className={`size-2 rounded-full ${EV_COLOR[e.type]}`} />
                      <span>{e.title}</span>
                      <span className="text-[11px] text-secondary">{e.type}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
          {d.events.length === 0 && <p className="py-5 text-sm text-secondary">Nothing due in the next 10 days.</p>}
        </Card>
      </div>

      <div className="grid items-start gap-8" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))" }}>
        {showMoney && (
          <Card title="Monthly Spend" aside={<Link href="/analytics" className="btn btn-ghost">Analytics →</Link>}>
            <div className="flex items-baseline gap-2.5 pb-3">
              <span className="text-4xl font-semibold tracking-[-0.02em]">{usdK(d.ytd)}</span>
              <span className="text-[13px] text-secondary">
                year to date
                {d.monthChange != null && ` · ${MON[d.months.length - 1]} ${d.monthChange >= 0 ? "+" : ""}${(d.monthChange * 100).toFixed(1)}% vs ${MON[d.months.length - 2]}`}
              </span>
            </div>
            <BarChart height={170} maxPct={84} color="bg-neutral-300" data={d.months.map((m, i) => ({ label: m.label, value: m.value, display: `$${Math.round(m.value / 1000)}K`, highlight: i === d.months.length - 1 }))} />
          </Card>
        )}
        {can(user.role, "view:budgets") && (
          <Card title="Brand Budgets" aside={<Link href="/budgets" className="btn btn-ghost">All brands →</Link>}>
            <div className="flex flex-col gap-3">
              {d.budgets.map((b) => (
                <Link key={b.brandId} href={`/budgets?brand=${b.brandId}`} className="flex flex-col gap-1.5 border-b border-neutral-200 pb-2.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold">{b.brand}</span>
                    <span className="text-[13px] text-secondary">
                      <b className="text-ink">{Math.round(b.utilization * 100)}%</b> used · {usdK(b.available)} left
                    </span>
                  </div>
                  <StackedBar a={b.budget ? b.purchased / b.budget : 0} b={b.budget ? b.committed / b.budget : 0} hot={b.hot} />
                </Link>
              ))}
              <div className="flex flex-wrap gap-4 text-xs text-secondary">
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-ink" />Purchased</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-neutral-500" />Committed</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-accent" />Committed, over 95%</span>
              </div>
            </div>
          </Card>
        )}
        <Card title="Incoming Inventory" aside={<Link href="/inventory?tab=incoming" className="btn btn-ghost">All stock →</Link>}>
          {d.worstStock && (
            <div className="mb-3 grid grid-cols-[10px_1fr] gap-2.5 rounded-[10px] bg-red-bg px-3 py-2.5 text-sm leading-snug text-red-fg">
              <span className="mt-[5px] size-2.5 rounded-full bg-accent" />
              <span>
                <b>{d.worstStock.name}</b> — Expected stockout {d.worstStock.incoming ? "before next shipment arrives" : "with nothing incoming"}.
              </span>
            </div>
          )}
          <div className="grid grid-cols-[minmax(0,1fr)_52px_64px_56px] gap-2.5 border-b border-line pt-1 pb-2 text-[12.5px] text-secondary">
            <span>Product</span>
            <span className="text-right">Stock</span>
            <span className="text-right">Incoming</span>
            <span className="text-right">ETA</span>
          </div>
          {d.inventory.map((p) => {
            const color = p.level === "risk" ? "text-red-fg" : p.level === "warn" ? "text-orange-fg" : "text-neutral-700";
            return (
              <Link key={p.productId} href={p.poNumber ? `/orders/${p.poNumber}` : "/inventory"} className="grid grid-cols-[minmax(0,1fr)_52px_64px_56px] items-center gap-2.5 border-b border-neutral-200 py-2 text-sm">
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate font-semibold">{p.name}</span>
                  <span className={`text-xs ${color}`}>{p.reason}</span>
                </span>
                <span className={`text-right font-semibold ${color}`}>{p.stock}</span>
                <span className="text-right">+{p.incoming.toLocaleString()}</span>
                <span className="text-right">{fmtDate(p.eta)}</span>
              </Link>
            );
          })}
        </Card>
      </div>
    </Page>
  );
}

function ActiveTable({ rows }: { rows: PoSummary[] }) {
  const cols = "96px minmax(120px,1.2fr) 84px 124px 120px 110px 60px 150px";
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[900px]">
        <div className="grid gap-3 border-b border-line py-2.5 text-[12.5px] text-secondary" style={{ gridTemplateColumns: cols }}>
          <span>PO</span>
          <span>Supplier</span>
          <span className="text-right">Value</span>
          <span>Payment</span>
          <span>Production</span>
          <span>Shipment</span>
          <span>ETA</span>
          <span>Health</span>
        </div>
        {rows.map((p) => {
          const l = poLabels(p);
          return (
            <Link key={p.id} href={`/orders/${p.number}`} className="grid items-center gap-3 border-b border-neutral-200 py-[11px] text-sm hover:bg-surface" style={{ gridTemplateColumns: cols }}>
              <span className="font-semibold">{p.number}</span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate">{p.supplier.name}</span>
                <span className="truncate text-xs text-secondary">{p.supplier.origin}</span>
              </span>
              <span className="text-right">{usd(p.total)}</span>
              <span><Pill label={l.pay} /></span>
              <span><Pill label={l.prod} /></span>
              <span><Pill label={l.ship} /></span>
              <span>{fmtDate(p.eta)}</span>
              <span className="flex min-w-0 flex-col leading-tight">
                <HealthDot label={l.health} />
                <span className="truncate text-xs text-secondary">{p.healthReason}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

