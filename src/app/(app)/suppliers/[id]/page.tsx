import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PoMiniRow } from "@/components/orders/PoMiniRow";
import { BarChart } from "@/components/ui/Bars";
import { Card, Empty, InfoList } from "@/components/ui/Card";
import { FileChip } from "@/components/ui/FileChip";
import { Page, PageHeader, StatRow } from "@/components/ui/PageHeader";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { fmtDate, MON, usdK, usdR } from "@/lib/format";
import { DOCUMENT_TYPE_LABEL } from "@/lib/status";
import { getSupplier } from "@/server/queries/suppliers";

export const metadata: Metadata = { title: "Supplier" };

export default async function SupplierPage({ params }: PageProps<"/suppliers/[id]">) {
  const user = await requirePermission("view:suppliers");
  const { id } = await params;
  const today = todayIso();
  const data = await getSupplier(id, today);
  if (!data) notFound();
  const { supplier: s, stats, current, history, lastYear, documents } = data;
  const canWrite = can(user.role, "supplier:write");

  return (
    <Page className="pt-4!">
      <PageHeader
        back={{ href: "/suppliers", label: "All suppliers" }}
        large
        title={s.name}
        subtitle={[s.country, `Supplier since ${s.createdAt.getUTCFullYear()}`, s.paymentTerms].filter(Boolean).join(" · ")}
        actions={
          <>
            {s.email && (
              <a href={`mailto:${s.email}`} className="btn btn-secondary">
                Email {s.contactName ?? s.name}
              </a>
            )}
            {canWrite && (
              <Link href={`/suppliers/${s.id}/edit`} className="btn btn-secondary">
                Edit
              </Link>
            )}
            {can(user.role, "po:write") && (
              <Link href={`/orders/new?supplier=${s.id}`} className="btn btn-primary">
                + New PO
              </Link>
            )}
          </>
        }
      />
      <StatRow
        stats={[
          { k: "Open Orders", v: stats.openOrders },
          { k: "Outstanding Payment", v: usdR(stats.outstanding) },
          { k: "Orders YTD", v: stats.ordersYtd },
          { k: "Purchase Value YTD", v: usdR(stats.valueYtd) },
          { k: "Units Purchased", v: stats.unitsYtd.toLocaleString() },
        ]}
      />
      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-[1_1_640px] flex-col gap-8">
          <Card title="Purchase History" aside={`Monthly, ${today.slice(0, 4)} · USD`}>
            <div className="mt-2">
              <BarChart data={history.map((h) => ({ label: MON[h.month - 1], value: h.value, display: h.value ? `$${(h.value / 1000).toFixed(1)}K` : "" }))} />
            </div>
            <div className="mt-3 flex gap-6 text-sm">
              <span>
                <span className="text-secondary">{Number(today.slice(0, 4)) - 1} total</span> <b>{lastYear ? usdK(lastYear) : "—"}</b>
              </span>
              <span>
                <span className="text-secondary">{today.slice(0, 4)} YTD</span> <b>{usdR(stats.valueYtd)}</b>
              </span>
              {s.onTimeRate != null && (
                <span>
                  <span className="text-secondary">On time</span> <b className={s.onTimeRate < 85 ? "text-accent" : ""}>{s.onTimeRate}%</b>
                </span>
              )}
            </div>
          </Card>
          <Card title="Current Orders" aside={`${current.length} active`}>
            {current.map((p) => (
              <PoMiniRow key={p.id} po={p} />
            ))}
            {current.length === 0 && <Empty>No active orders.</Empty>}
          </Card>
        </div>
        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-8">
          <Card title="Supplier Information">
            <InfoList
              rows={[
                { k: "Supplier name", v: s.name },
                { k: "PO prefix", v: s.code },
                { k: "Country", v: s.origin },
                { k: "Contact person", v: s.contactName ?? "—" },
                { k: "Email", v: s.email ? <a className="underline" href={`mailto:${s.email}`}>{s.email}</a> : "—" },
                { k: "Phone", v: s.phone ?? "—" },
                { k: "Website", v: s.website ?? "—" },
                { k: "Payment terms", v: s.paymentTerms ?? "—" },
                { k: "Currency", v: s.currency },
                { k: "Shipping terms", v: [s.incoterm, s.incotermPlace].filter(Boolean).join(" ") || "—" },
                { k: "Avg lead time", v: s.leadTimeDays != null ? `${s.leadTimeDays} days` : "—" },
              ]}
            />
            {s.notes && (
              <div className="mt-3 rounded-[10px] bg-neutral-100 px-3.5 py-3 text-sm leading-normal">
                <div className="mb-1 text-[12.5px] text-secondary">Notes</div>
                {s.notes}
              </div>
            )}
          </Card>
          <Card title="Documents" aside={<Link href={`/documents?supplier=${s.id}`} className="font-semibold text-ink">All →</Link>}>
            {documents.map((d) => (
              <a key={d.id} href={`/api/documents/${d.id}`} className="flex items-center gap-2.5 border-b border-neutral-200 py-2 text-sm last:border-b-0 hover:bg-surface">
                <FileChip fileName={d.fileName} />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <b>{d.title ?? DOCUMENT_TYPE_LABEL[d.type]}</b>
                  <span className="truncate text-xs text-secondary">{d.fileName}</span>
                </span>
                <span className="text-xs text-secondary">{fmtDate(d.date)}</span>
              </a>
            ))}
            {documents.length === 0 && <Empty>No supplier documents yet. Agreements and price lists uploaded on the Documents screen appear here.</Empty>}
          </Card>
        </div>
      </div>
    </Page>
  );
}
