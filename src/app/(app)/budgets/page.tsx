import type { Metadata } from "next";
import Link from "next/link";
import { BudgetDialog } from "@/components/budgets/BudgetDialog";
import { BarChart, StackedBar } from "@/components/ui/Bars";
import { Empty } from "@/components/ui/Card";
import { Page, PageHeader, StatRow } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { Segment } from "@/components/ui/Segment";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { fmtDate, MON, usd, usdK, usdR } from "@/lib/format";
import { PAYMENT_STATUS_LABEL, poLabels } from "@/lib/status";
import { brandTrend, getBudgets, openBrandPos } from "@/server/queries/budgets";

export const metadata: Metadata = { title: "Brand Budgets" };

export default async function BudgetsPage({ searchParams }: PageProps<"/budgets">) {
  const user = await requirePermission("view:budgets");
  const sp = await searchParams;
  const today = todayIso();
  const year = Number(typeof sp.year === "string" ? sp.year : today.slice(0, 4));
  const history = sp.tab === "history";
  const { rows, pos, brands } = await getBudgets(year, today);
  const canEdit = can(user.role, "budget:write");
  const sum = (k: "budget" | "purchased" | "committed") => rows.reduce((s, r) => s + r[k], 0);
  const sel = rows.find((r) => r.brandId === sp.brand) ?? rows[0];
  const throughMonth = year === Number(today.slice(0, 4)) ? Number(today.slice(5, 7)) : 12;
  const brandsWithoutBudget = brands.filter((b) => !rows.some((r) => r.brandId === b.id)).map((b) => b.name);
  const tabs = [
    { label: "Budgets", href: `/budgets${sp.brand ? `?brand=${sp.brand}` : ""}`, active: !history },
    { label: "Purchase history", href: "/budgets?tab=history", active: history },
  ];

  return (
    <Page>
      <PageHeader
        title="Brand Budgets"
        subtitle={`Annual procurement budget per brand, ${year}. Committed = open PO value not yet invoiced.`}
        actions={
          <>
            <Segment items={tabs} />
            {canEdit && brandsWithoutBudget.length > 0 && <BudgetDialog brands={brandsWithoutBudget} year={year} label="+ Add budget" />}
          </>
        }
      />
      <StatRow
        size={36}
        min={180}
        stats={[
          { k: "Annual Budget", v: usdK(sum("budget")) },
          { k: "Purchased", v: usdK(sum("purchased")) },
          { k: "Committed", v: usdK(sum("committed")) },
          { k: "Available", v: usdK(sum("budget") - sum("purchased") - sum("committed")) },
        ]}
      />

      {history ? (
        <PurchaseHistory pos={pos} brands={brands} brandId={typeof sp.brand === "string" ? sp.brand : undefined} />
      ) : rows.length === 0 ? (
        <div className="card">
          <Empty>No brand budgets for {year} yet.{canEdit ? " Use “Add budget” to set one." : ""}</Empty>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-8">
          <section className="card min-w-0 flex-[1_1_640px] overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="grid gap-3 border-b border-line py-2.5 text-[12.5px] text-secondary" style={{ gridTemplateColumns: COLS }}>
                <span>Brand</span>
                <span className="text-right">Budget</span>
                <span className="text-right">Purchased</span>
                <span className="text-right">Committed</span>
                <span className="text-right">Available</span>
                <span>Utilization</span>
                <span className="text-right">Used</span>
              </div>
              {rows.map((b) => {
                const on = b.brandId === sel?.brandId;
                return (
                  <Link
                    key={b.brandId}
                    href={`/budgets?brand=${b.brandId}`}
                    scroll={false}
                    className={`grid items-center gap-3 border-b border-neutral-200 py-3 text-sm hover:bg-surface ${on ? "bg-surface" : ""}`}
                    style={{ gridTemplateColumns: COLS }}
                  >
                    <span className={`border-l-4 pl-2 font-semibold ${on ? "border-accent" : "border-transparent"}`}>{b.brand}</span>
                    <span className="text-right">{usdK(b.budget)}</span>
                    <span className="text-right">{usdK(b.purchased)}</span>
                    <span className="text-right">{usdK(b.committed)}</span>
                    <span className={`text-right font-semibold ${b.hot ? "text-red-fg" : ""}`}>{usdK(b.available)}</span>
                    <StackedBar a={b.budget ? b.purchased / b.budget : 0} b={b.budget ? b.committed / b.budget : 0} hot={b.hot} />
                    <b className="text-right">{Math.round(b.utilization * 100)}%</b>
                  </Link>
                );
              })}
              <div className="flex flex-wrap gap-4 pt-3 text-xs text-secondary">
                <Legend color="bg-ink" label="Purchased" />
                <Legend color="bg-neutral-500" label="Committed" />
                <Legend color="bg-accent" label="Committed, over 95% of budget" />
              </div>
            </div>
          </section>

          {sel && (
            <section className="card flex min-w-0 flex-[1_1_380px] flex-col gap-4 bg-surface! p-4!">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-lg">{sel.brand}</h2>
                <span className="text-[15px] font-semibold">{Math.round(sel.utilization * 100)}% utilized</span>
              </div>
              <div className="grid grid-cols-2">
                {[
                  ["Annual Budget", usdR(sel.budget)],
                  ["Purchased", usdR(sel.purchased)],
                  ["Committed", usdR(sel.committed)],
                  ["Available", usdR(sel.available)],
                ].map(([k, v]) => (
                  <div key={k} className="flex flex-col gap-0.5 border-b border-neutral-400 py-2.5">
                    <span className="text-[12.5px] text-secondary">{k}</span>
                    <span className={`text-[22px] font-semibold ${k === "Available" && sel.hot ? "text-red-fg" : ""}`}>{v}</span>
                  </div>
                ))}
              </div>
              <StackedBar a={sel.budget ? sel.purchased / sel.budget : 0} b={sel.budget ? sel.committed / sel.budget : 0} hot={sel.hot} className="h-3.5 bg-page!" />
              <div className="text-[12.5px] text-secondary">Monthly purchase trend</div>
              <BarChart
                height={110}
                maxPct={100}
                showValues={false}
                data={brandTrend(pos, sel.brandId, year, throughMonth).map((t) => ({ label: MON[t.month - 1], value: t.value, display: usdR(t.value) }))}
              />
              <div className="text-[12.5px] text-secondary">Open POs against this budget</div>
              {openBrandPos(pos, sel.brandId).map((p) => (
                <Link key={p.id} href={`/orders/${p.number}`} className="flex justify-between border-b border-neutral-400 py-2 text-sm hover:text-accent">
                  <b>{p.number}</b>
                  <span>
                    {usd(p.total)} · {PAYMENT_STATUS_LABEL[p.paymentStatus]}
                  </span>
                </Link>
              ))}
              {openBrandPos(pos, sel.brandId).length === 0 && <span className="text-sm text-secondary">No open orders.</span>}
              {canEdit && (
                <div className="pt-1">
                  <BudgetDialog brands={[]} year={year} brand={sel.brand} amount={sel.budget} label="Edit budget" />
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </Page>
  );
}

const COLS = "minmax(110px,1fr) 64px 76px 76px 76px minmax(110px,1.5fr) 44px";

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function PurchaseHistory({
  pos,
  brands,
  brandId,
}: {
  pos: Awaited<ReturnType<typeof getBudgets>>["pos"];
  brands: { id: string; name: string }[];
  brandId?: string;
}) {
  const shown = pos.filter((p) => !brandId || p.brand.id === brandId);
  const used = brands.filter((b) => pos.some((p) => p.brand.id === b.id));
  return (
    <section className="card overflow-x-auto">
      <div className="mb-3 flex flex-wrap gap-2">
        <Link href="/budgets?tab=history" className={`rounded-full border px-3 py-1 text-[13px] ${!brandId ? "border-ink bg-ink text-page" : "border-line-input"}`}>
          All brands
        </Link>
        {used.map((b) => (
          <Link
            key={b.id}
            href={`/budgets?tab=history&brand=${b.id}`}
            className={`rounded-full border px-3 py-1 text-[13px] ${brandId === b.id ? "border-ink bg-ink text-page" : "border-line-input"}`}
          >
            {b.name}
          </Link>
        ))}
      </div>
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[12.5px] text-secondary">
            <th className="py-2.5 font-normal">PO</th>
            <th className="font-normal">Ordered</th>
            <th className="font-normal">Brand</th>
            <th className="font-normal">Supplier</th>
            <th className="text-right font-normal">Units</th>
            <th className="text-right font-normal">Value</th>
            <th className="pl-4 font-normal">Status</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((p) => (
            <tr key={p.id} className="border-b border-neutral-200 hover:bg-surface">
              <td className="py-2.5">
                <Link href={`/orders/${p.number}`} className="font-semibold">
                  {p.number}
                </Link>
              </td>
              <td>{fmtDate(p.orderDate)}</td>
              <td>{p.brand.name}</td>
              <td>{p.supplier.name}</td>
              <td className="text-right">{p.units.toLocaleString()}</td>
              <td className="text-right">{usd(p.total)}</td>
              <td className="pl-4">
                <Pill label={p.poStatus === "CLOSED" ? "Closed" : poLabels(p).health} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="py-3" colSpan={4}>
              {shown.length} orders
            </td>
            <td className="text-right">{shown.reduce((s, p) => s + p.units, 0).toLocaleString()}</td>
            <td className="text-right">{usd(shown.reduce((s, p) => s + p.total, 0))}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
