import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { Segment } from "@/components/ui/Segment";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { ON_TIME_THRESHOLD } from "@/lib/domain/suppliers";
import { usdK, usdR } from "@/lib/format";
import { HEALTH_LABEL } from "@/lib/status";
import { listSuppliers } from "@/server/queries/suppliers";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage({ searchParams }: PageProps<"/suppliers">) {
  const user = await requirePermission("view:suppliers");
  const { tab } = await searchParams;
  const perf = tab === "performance";
  const suppliers = await listSuppliers(todayIso());
  const ytd = suppliers.reduce((s, x) => s + x.valueYtd, 0);

  return (
    <Page>
      <PageHeader
        title="Suppliers"
        subtitle={`${suppliers.length} active suppliers · ${usdK(ytd)} purchased year to date`}
        actions={
          <>
            <Segment
              items={[
                { label: "Suppliers", href: "/suppliers", active: !perf },
                { label: "Performance", href: "/suppliers?tab=performance", active: perf },
              ]}
            />
            {can(user.role, "supplier:write") && (
              <Link href="/suppliers/new" className="btn btn-primary">
                <Plus size={15} /> New supplier
              </Link>
            )}
          </>
        }
      />

      {!perf ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))" }}>
          {suppliers.map((s) => (
            <Link key={s.id} href={`/suppliers/${s.id}`} className="flex flex-col gap-3 rounded-card border border-line bg-white p-4 hover:border-neutral-400">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[25px] font-semibold tracking-[-0.01em]">{s.name}</span>
                  <span className="text-[13px] text-secondary">
                    {s.country}
                    {s.contactName ? ` · ${s.contactName}` : ""}
                  </span>
                </div>
                {s.worst && <Pill label={s.worst.healthReason} tone={s.worst.health === "DELAYED" ? "red" : "orange"} className="max-w-[55%] whitespace-normal! text-[11px]! font-semibold" />}
              </div>
              <div className="grid grid-cols-2 border-t border-line">
                {[
                  ["Open Orders", s.openOrders],
                  ["Outstanding Payment", usdR(s.outstanding)],
                  ["Orders YTD", s.ordersYtd],
                  ["Purchase Value YTD", usdR(s.valueYtd)],
                ].map(([k, v]) => (
                  <div key={k} className="flex flex-col gap-0.5 border-b border-neutral-400 py-2.5">
                    <span className="text-[12.5px] text-secondary">{k}</span>
                    <span className="text-xl font-semibold">{v}</span>
                  </div>
                ))}
              </div>
              <span className="text-[13px] text-neutral-800">
                {s.unitsYtd.toLocaleString()} units purchased · {s.leadTimeDays ?? "—"} day avg lead time
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <PerformanceTable suppliers={suppliers} />
      )}
    </Page>
  );
}

function PerformanceTable({ suppliers }: { suppliers: Awaited<ReturnType<typeof listSuppliers>> }) {
  const rows = [...suppliers].sort((a, b) => (b.onTimeRate ?? -1) - (a.onTimeRate ?? -1));
  const maxLead = Math.max(1, ...rows.map((s) => s.leadTimeDays ?? 0));
  const cols = "minmax(140px,1fr) 90px 110px minmax(200px,1.4fr) minmax(200px,1.4fr) 100px";
  return (
    <div className="card overflow-x-auto px-5! pt-1.5! pb-2!">
      <div className="min-w-[960px]">
        <div className="grid gap-4 border-b border-line py-2.5 text-[12.5px] text-secondary" style={{ gridTemplateColumns: cols }}>
          <span>Supplier</span>
          <span className="text-right">Orders YTD</span>
          <span className="text-right">Value YTD</span>
          <span>On-time delivery</span>
          <span>Avg lead time</span>
          <span>Open issues</span>
        </div>
        {rows.map((s) => (
          <Link key={s.id} href={`/suppliers/${s.id}`} className="grid items-center gap-4 border-b border-neutral-200 py-3 text-sm hover:bg-surface" style={{ gridTemplateColumns: cols }}>
            <span className="font-semibold">{s.name}</span>
            <span className="text-right">{s.ordersYtd}</span>
            <span className="text-right">{usdK(s.valueYtd)}</span>
            <HBarInline value={s.onTimeRate ?? 0} max={100} display={s.onTimeRate == null ? "—" : `${s.onTimeRate}%`} red={s.onTimeRate != null && s.onTimeRate < ON_TIME_THRESHOLD} width={44} />
            <HBarInline value={s.leadTimeDays ?? 0} max={maxLead} display={s.leadTimeDays == null ? "—" : `${s.leadTimeDays} days`} width={56} />
            <span className={`font-semibold ${s.issues.length ? "text-accent" : "text-neutral-600"}`} title={s.issues.map((i) => `${i.number}: ${HEALTH_LABEL[i.health]}`).join("\n")}>
              {s.issues.length || "—"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function HBarInline({ value, max, display, red = false, width }: { value: number; max: number; display: string; red?: boolean; width: number }) {
  return (
    <span className="grid items-center gap-2.5" style={{ gridTemplateColumns: `1fr ${width}px` }}>
      <span className="h-2 overflow-hidden rounded bg-neutral-200">
        <span className={`block h-full ${red ? "bg-accent" : "bg-ink"}`} style={{ width: `${(value / max) * 100}%` }} />
      </span>
      <b className="text-right">{display}</b>
    </span>
  );
}

