import type { Metadata } from "next";
import Link from "next/link";
import { Page, PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { Segment } from "@/components/ui/Segment";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { fmtDate } from "@/lib/format";
import { inventoryRows } from "@/server/queries/insights";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  const user = await requirePermission("view:inventory");
  const { tab: t } = await searchParams;
  const tab = t === "incoming" || t === "reorder" ? t : "stock";
  const all = await inventoryRows(todayIso());
  const incoming = all.filter((r) => r.incoming > 0);
  const alerts = all.filter((r) => r.level !== "ok");
  const rows = tab === "incoming" ? incoming : tab === "reorder" ? alerts : [...all].sort((a, b) => (a.coverDays ?? 1e9) - (b.coverDays ?? 1e9));
  const worst = all.find((r) => r.level === "risk");
  const cols = "minmax(160px,1.4fr) 130px 90px 80px 100px 64px 72px minmax(220px,1.4fr)";

  return (
    <Page className="gap-4!">
      <PageHeader
        title="Incoming Inventory"
        subtitle="Current stock against open purchase orders. Cover is stock ÷ daily sales rate."
        actions={
          <>
            <Segment
              items={[
                { label: "Current stock", href: "/inventory", active: tab === "stock", count: all.length },
                { label: "Incoming", href: "/inventory?tab=incoming", active: tab === "incoming", count: incoming.length },
                { label: "Reorder alerts", href: "/inventory?tab=reorder", active: tab === "reorder", count: alerts.length },
              ]}
            />
            <Link href="/products" className="btn btn-secondary">
              Manage products
            </Link>
          </>
        }
      />
      {worst && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-tile border border-red-bg bg-red-bg px-4 py-3 text-[15px] text-red-fg">
          <span className="flex items-center gap-2.5">
            <span className="size-2.5 flex-none rounded-full bg-accent" />
            <span>
              <b>{worst.name}</b> — Expected stockout {worst.incoming ? "before next shipment arrives" : "with nothing on order"}. {worst.reason}.
            </span>
          </span>
          <span className="flex gap-2">
            {worst.poNumber && (
              <Link href={`/orders/${worst.poNumber}`} className="btn btn-secondary">
                View {worst.poNumber}
              </Link>
            )}
            {can(user.role, "po:write") && (
              <Link href="/orders/new" className="btn btn-primary">
                Expedite / reorder
              </Link>
            )}
          </span>
        </div>
      )}
      <div className="card hidden overflow-x-auto px-5! pt-1.5! pb-2! md:block">
        <div className="min-w-[1080px]">
          <div className="grid gap-3 border-b border-line py-2.5 text-[12.5px] text-secondary" style={{ gridTemplateColumns: cols }}>
            <span>Product</span>
            <span>SKU</span>
            <span className="text-right">Current Stock</span>
            <span className="text-right">Incoming</span>
            <span className="text-right">Expected Total</span>
            <span>ETA</span>
            <span className="text-right">Cover</span>
            <span>Status</span>
          </div>
          {rows.map((r) => (
            <Link
              key={r.productId}
              href={r.poNumber ? `/orders/${r.poNumber}` : `/products?q=${encodeURIComponent(r.sku)}`}
              className="grid items-center gap-3 border-b border-neutral-200 py-3 text-sm hover:bg-surface"
              style={{ gridTemplateColumns: cols }}
            >
              <b className="truncate">{r.name}</b>
              <span className="truncate text-[13px] text-secondary">{r.sku}</span>
              <span className={`text-right font-semibold ${r.level === "risk" ? "text-red-fg" : ""}`}>{r.stock.toLocaleString()}</span>
              <span className="text-right">{r.incoming ? `+${r.incoming.toLocaleString()}` : "—"}</span>
              <span className="text-right">{(r.stock + r.incoming).toLocaleString()}</span>
              <span>{fmtDate(r.eta)}</span>
              <span className="text-right">{r.coverDays == null ? "—" : `${r.coverDays} days`}</span>
              <span className="flex min-w-0 items-center gap-2">
                <Pill label={r.label} tone={r.level === "risk" ? "red" : r.level === "warn" ? "orange" : "green"} />
                <span className={`truncate text-xs ${r.level === "risk" ? "text-red-fg" : r.level === "warn" ? "text-orange-fg" : "text-secondary"}`}>{r.reason}</span>
              </span>
            </Link>
          ))}
          {rows.length === 0 && <div className="py-10 text-[15px] text-secondary">Nothing here.</div>}
        </div>
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((r) => (
          <Link key={r.productId} href={r.poNumber ? `/orders/${r.poNumber}` : "/products"} className="card flex flex-col gap-1.5 p-4!">
            <div className="flex justify-between gap-2">
              <b>{r.name}</b>
              <Pill label={r.label} tone={r.level === "risk" ? "red" : r.level === "warn" ? "orange" : "green"} />
            </div>
            <span className="text-xs text-secondary">
              {r.stock} in stock · +{r.incoming} incoming · ETA {fmtDate(r.eta)}
            </span>
            <span className="text-xs">{r.reason}</span>
          </Link>
        ))}
      </div>
    </Page>
  );
}
