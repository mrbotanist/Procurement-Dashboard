import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
import { OrderFacets } from "@/components/orders/OrderFacets";
import { OrdersTable } from "@/components/orders/OrdersTable";
import { Page, PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { QUICK_FILTERS } from "@/lib/domain/orders";
import { MONL } from "@/lib/format";
import { PAYMENT_STATUS_LABEL, SHIPMENT_STATUS_LABEL } from "@/lib/status";
import { listOrders, parseOrderParams } from "@/server/queries/orders";

export const metadata: Metadata = { title: "All Purchase Orders" };

const FILTER_LABEL: Record<string, string> = { production: "In production", customs: "Customs documents required" };

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const user = await requirePermission("view:orders");
  const sp = await searchParams;
  const params = parseOrderParams(sp);
  const today = todayIso();
  const data = await listOrders(params, today);

  const qs = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string") next.set(k, v);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) next.delete(k);
      else next.set(k, v);
    }
    const s = next.toString();
    return s ? `/orders?${s}` : "/orders";
  };

  const monthLabel = (m: string) => `${MONL[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
  const chips: { label: string; href: string }[] = [];
  if (params.stage) chips.push({ label: `Stage: ${params.stage}`, href: qs({ stage: undefined, scope: undefined }) });
  if (FILTER_LABEL[params.f]) chips.push({ label: FILTER_LABEL[params.f], href: qs({ f: undefined }) });
  if (params.q) chips.push({ label: `Search: “${params.q}”`, href: qs({ q: undefined }) });
  if (params.supplier) chips.push({ label: data.suppliers.find((s) => s.id === params.supplier)?.name ?? "Supplier", href: qs({ supplier: undefined }) });
  if (params.brand) chips.push({ label: data.brands.find((b) => b.id === params.brand)?.name ?? "Brand", href: qs({ brand: undefined }) });
  if (params.pay) chips.push({ label: PAYMENT_STATUS_LABEL[params.pay as keyof typeof PAYMENT_STATUS_LABEL] ?? params.pay, href: qs({ pay: undefined }) });
  if (params.ship) chips.push({ label: SHIPMENT_STATUS_LABEL[params.ship as keyof typeof SHIPMENT_STATUS_LABEL] ?? params.ship, href: qs({ ship: undefined }) });
  if (params.date) chips.push({ label: params.date === "30d" ? "Last 30 days" : params.date === "90d" ? "Last 90 days" : monthLabel(params.date), href: qs({ date: undefined }) });
  if (params.scope !== "open") chips.push({ label: params.scope === "closed" ? "Closed orders" : "Open and closed", href: qs({ scope: undefined }) });

  const exportHref = `/api/orders/export?${new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][])}`;

  return (
    <Page className="gap-4!">
      <PageHeader
        title="All Purchase Orders"
        subtitle={`${data.openCount} open orders · ${data.rows.length} of ${data.total} shown`}
        actions={
          <>
            <a href={exportHref} className="btn btn-secondary">
              Export CSV
            </a>
            {can(user.role, "po:write") && (
              <Link href="/orders/new" className="btn btn-primary">
                + New PO
              </Link>
            )}
          </>
        }
      />

      <div className="flex max-w-full flex-wrap self-start overflow-hidden rounded-[10px] border border-line bg-white">
        {QUICK_FILTERS.map((q) => {
          const on = params.f === q.key;
          return (
            <Link
              key={q.key}
              href={qs({ f: q.key === "all" ? undefined : q.key })}
              scroll={false}
              className={`flex items-center gap-2 border-r border-line px-3.5 py-2 text-[13px] last:border-r-0 ${on ? "bg-ink text-page" : "hover:bg-page"}`}
            >
              {q.label}
              <b className="font-semibold">{data.counts[q.key]}</b>
            </Link>
          );
        })}
      </div>

      <OrderFacets
        facets={[
          { key: "supplier", label: "Supplier", options: [{ value: "", label: "All" }, ...data.suppliers.map((s) => ({ value: s.id, label: s.name }))] },
          { key: "brand", label: "Brand", options: [{ value: "", label: "All" }, ...data.brands.map((b) => ({ value: b.id, label: b.name }))] },
          { key: "pay", label: "Payment status", options: [{ value: "", label: "All" }, ...Object.entries(PAYMENT_STATUS_LABEL).map(([value, label]) => ({ value, label }))] },
          { key: "ship", label: "Shipment status", options: [{ value: "", label: "All" }, ...Object.entries(SHIPMENT_STATUS_LABEL).map(([value, label]) => ({ value, label }))] },
          {
            key: "date",
            label: "Order date",
            options: [
              { value: "", label: "Any time" },
              { value: "30d", label: "Last 30 days" },
              { value: "90d", label: "Last 90 days" },
              ...data.months.map((m) => ({ value: m, label: monthLabel(m) })),
            ],
          },
          { key: "currency", label: "Currency", options: [{ value: "", label: "All" }, ...data.currencies.map((c) => ({ value: c, label: c }))] },
          {
            key: "scope",
            label: "Orders",
            options: [
              { value: "", label: "Open" },
              { value: "closed", label: "Closed & cancelled" },
              { value: "all", label: "All" },
            ],
          },
        ]}
      />

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <span key={c.label} className="inline-flex items-center gap-2 bg-ink py-1 pr-1 pl-2.5 text-[13px] text-page">
              {c.label}
              <Link href={c.href} scroll={false} aria-label={`Remove ${c.label}`} className="flex size-5 items-center justify-center hover:bg-accent">
                <X size={13} />
              </Link>
            </span>
          ))}
          <Link href="/orders" className="btn btn-ghost">
            Clear all
          </Link>
        </div>
      )}

      <OrdersTable rows={data.rows} />
    </Page>
  );
}
