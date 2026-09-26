import type { Metadata } from "next";
import Link from "next/link";
import { BarChart, HBarRows } from "@/components/ui/Bars";
import { Card, Empty } from "@/components/ui/Card";
import { Page, PageHeader } from "@/components/ui/PageHeader";
import { Segment } from "@/components/ui/Segment";
import { requirePermission } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { LEAD_TIME_THRESHOLD } from "@/lib/domain/suppliers";
import { fmtDateLong, usd, usdK } from "@/lib/format";
import { analytics } from "@/server/queries/insights";

export const metadata: Metadata = { title: "Analytics" };

const STATUS_COLOR = ["#a3a7ae", "oklch(0.52 0.15 255)", "oklch(0.72 0.15 70)", "#17181b"];

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  await requirePermission("view:analytics");
  const sp = await searchParams;
  const tab = sp.tab === "brands" || sp.tab === "products" ? sp.tab : "spend";
  const range = typeof sp.range === "string" ? sp.range : undefined;
  const today = todayIso();
  const a = await analytics(today, range);
  const rq = range ? `&range=${range}` : "";
  const pct = (x: number | null) => (x == null ? "no prior-year data" : `${x >= 0 ? "+" : ""}${Math.round(x * 100)}% vs same period last year`);

  return (
    <Page>
      <PageHeader
        title="Procurement Analytics"
        subtitle={`${fmtDateLong(a.range.from)} – ${fmtDateLong(a.range.to)} · USD · change the period with the date range at the top`}
        actions={
          <Segment
            items={[
              { label: "Spend", href: `/analytics?tab=spend${rq}`, active: tab === "spend" },
              { label: "Brands", href: `/analytics?tab=brands${rq}`, active: tab === "brands" },
              { label: "Products", href: `/analytics?tab=products${rq}`, active: tab === "products" },
            ]}
          />
        }
      />
      <div className="grid border-b border-line" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
        {[
          ["Total procurement", usdK(a.total), pct(a.changeVsLastYear)],
          ["This month", usdK(a.thisMonth), "Month to date"],
          ["Number of POs", String(a.count), `${a.open} open · ${a.closed} closed`],
          ["Average PO value", usd(Math.round(a.avgPo)), `${usdK(a.total)} across ${a.count} POs`],
          ["Avg supplier lead time", a.avgLead == null ? "—" : `${a.avgLead.toFixed(1)} days`, "Order to arrival, completed orders"],
          ["Delayed orders", String(a.delayed), "Past an expected milestone"],
        ].map(([k, v, s], i) => (
          <div key={k} className="flex flex-col gap-1 pr-4 pb-4">
            <span className="text-[12.5px] text-secondary">{k}</span>
            <span className={`text-[32px] font-semibold tracking-[-0.02em] ${i === 5 && a.delayed ? "text-accent" : ""}`}>{v}</span>
            <span className="text-xs text-secondary">{s}</span>
          </div>
        ))}
      </div>

      {tab === "spend" && (
        <div className="grid items-start gap-8" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(420px,1fr))" }}>
          <Card title="Monthly Procurement Spend" aside={today.slice(0, 4)}>
            <div className="mt-2">
              <BarChart height={200} maxPct={88} color="bg-neutral-300" data={a.months.map((m, i) => ({ label: m.label, value: m.value, display: `$${Math.round(m.value / 1000)}K`, highlight: i === a.months.length - 1 }))} />
            </div>
          </Card>
          <Card title="PO Status" aside={`${a.count} POs in period`}>
            <StatusDonut status={a.status} total={a.count} />
          </Card>
          <Card title="Spend by Supplier">
            <HBarRows rows={a.bySupplier.map(([k, v]) => ({ label: k, value: v, max: a.bySupplier[0]?.[1] ?? 1, display: usdK(v) }))} />
            {a.bySupplier.length === 0 && <Empty>No orders in this period.</Empty>}
          </Card>
          <Card title="Average Lead Time by Supplier">
            <HBarRows rows={a.lead.map((l) => ({ label: l.name, value: l.days, max: a.lead[0]?.days ?? 1, display: `${l.days} d`, color: l.days > LEAD_TIME_THRESHOLD ? "bg-accent" : "bg-ink" }))} />
            <span className="mt-2 text-xs text-secondary">Red: above {LEAD_TIME_THRESHOLD} days. Measured from order to arrival on completed orders.</span>
          </Card>
          <Card title="Spend by Brand">
            <HBarRows rows={a.byBrand.map(([k, v]) => ({ label: k, value: v, max: a.byBrand[0]?.[1] ?? 1, display: usdK(v) }))} />
          </Card>
          <Card title="Spend by Category & Country">
            <HBarRows rows={a.byCategory.map(([k, v]) => ({ label: k, value: v, max: a.byCategory[0]?.[1] ?? 1, display: a.total ? `${Math.round((v / a.total) * 100)}%` : "—" }))} valueWidth={48} />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {a.byCountry.map((c) => (
                <div key={c.k} className="flex flex-col rounded-tile bg-subtle px-3.5 py-3">
                  <span className="text-[13px] text-secondary">{c.k}</span>
                  <span className="text-2xl font-semibold">{usdK(c.value)}</span>
                  <span className="text-xs text-secondary">
                    {a.total ? Math.round((c.value / a.total) * 100) : 0}% · {c.suppliers} {c.suppliers === 1 ? "supplier" : "suppliers"}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "brands" && (
        <Card title="Brand Analysis" aside={<Link href="/budgets" className="btn btn-ghost">Budgets →</Link>}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[12.5px] text-secondary">
                <th className="py-2.5 font-normal">Brand</th>
                <th className="text-right font-normal">Spend</th>
                <th className="text-right font-normal">Share</th>
                <th className="w-1/3 pl-6 font-normal" />
              </tr>
            </thead>
            <tbody>
              {a.byBrand.map(([k, v]) => (
                <tr key={k} className="border-b border-neutral-200">
                  <td className="py-2.5 font-semibold">{k}</td>
                  <td className="text-right">{usd(Math.round(v))}</td>
                  <td className="text-right">{a.total ? `${((v / a.total) * 100).toFixed(1)}%` : "—"}</td>
                  <td className="pl-6">
                    <span className="block h-2 overflow-hidden rounded bg-neutral-200">
                      <span className="block h-full rounded bg-ink" style={{ width: `${(v / (a.byBrand[0]?.[1] || 1)) * 100}%` }} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "products" && (
        <Card title="Product Analysis" subtitle="Units and spend per product in the period.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[12.5px] text-secondary">
                  <th className="py-2.5 font-normal">Product</th>
                  <th className="font-normal">SKU</th>
                  <th className="text-right font-normal">POs</th>
                  <th className="text-right font-normal">Units</th>
                  <th className="text-right font-normal">Spend</th>
                  <th className="text-right font-normal">Avg unit cost</th>
                </tr>
              </thead>
              <tbody>
                {a.products.map((p) => (
                  <tr key={p.sku} className="border-b border-neutral-200">
                    <td className="py-2.5 font-semibold">{p.name}</td>
                    <td className="text-[13px] text-secondary">{p.sku}</td>
                    <td className="text-right">{p.pos}</td>
                    <td className="text-right">{p.units.toLocaleString()}</td>
                    <td className="text-right">{usd(Math.round(p.spend))}</td>
                    <td className="text-right">{usd(Math.round((p.spend / p.units) * 100) / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Page>
  );
}

function StatusDonut({ status, total }: { status: { k: string; v: number }[]; total: number }) {
  const r = 60;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-8 pt-2">
      <svg viewBox="0 0 160 160" className="size-40 flex-none" role="img" aria-label={status.map((s) => `${s.k}: ${s.v}`).join(", ")}>
        <circle cx="80" cy="80" r={r} fill="none" stroke="#eef0f2" strokeWidth="22" />
        {status.map((s, i) => {
          const len = total ? (s.v / total) * c : 0;
          const gap = len > 4 ? 2 : 0;
          const el = (
            <circle key={s.k} cx="80" cy="80" r={r} fill="none" stroke={STATUS_COLOR[i]} strokeWidth="22" strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-offset} transform="rotate(-90 80 80)">
              <title>{`${s.k}: ${s.v}`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
        <text x="80" y="78" textAnchor="middle" className="fill-ink text-[28px] font-semibold">
          {total}
        </text>
        <text x="80" y="98" textAnchor="middle" className="fill-[#62666d] text-[11px]">
          POs
        </text>
      </svg>
      <div className="flex min-w-[180px] flex-1 flex-col gap-2">
        {status.map((s, i) => (
          <div key={s.k} className="flex items-center gap-2.5 text-sm">
            <span className="size-2.5 rounded-full" style={{ background: STATUS_COLOR[i] }} />
            <span className="flex-1">{s.k}</span>
            <b>{s.v}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
