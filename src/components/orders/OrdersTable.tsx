import Link from "next/link";
import { Chip, HealthDot, Pill } from "@/components/ui/Pill";
import { fmtDate, usd } from "@/lib/format";
import { poLabels } from "@/lib/status";
import type { PoSummary } from "@/server/queries/pos";

const COLS = "92px minmax(140px,1.3fr) 64px 92px 90px 124px 120px 116px 140px 60px 180px";

export function brandLine(p: PoSummary) {
  return p.brand.name === p.supplier.name ? p.supplier.origin : `${p.brand.name} · ${p.supplier.origin}`;
}

/** Full PO table on desktop; card list below 768px. */
export function OrdersTable({ rows, empty = "No orders match these filters." }: { rows: PoSummary[]; empty?: string }) {
  return (
    <>
      <div className="card hidden overflow-x-auto px-5! pt-1.5! pb-2! md:block">
        <div className="min-w-[1260px]">
          <div className="grid gap-3 border-b border-line py-2.5 text-[12.5px] text-secondary" style={{ gridTemplateColumns: COLS }}>
            <span>PO Number</span>
            <span>Supplier / Brand</span>
            <span>Ordered</span>
            <span className="text-right">Total Value</span>
            <span>PO Status</span>
            <span>Payment</span>
            <span>Production</span>
            <span>Shipment</span>
            <span>Customs</span>
            <span>ETA</span>
            <span>Health</span>
          </div>
          {rows.map((p) => {
            const l = poLabels(p);
            return (
              <Link key={p.id} href={`/orders/${p.number}`} className="grid items-center gap-3 border-b border-neutral-200 py-3 text-sm hover:bg-surface" style={{ gridTemplateColumns: COLS }}>
                <span className="font-semibold">{p.number}</span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate">{p.supplier.name}</span>
                  <span className="truncate text-xs text-secondary">{brandLine(p)}</span>
                </span>
                <span className="text-neutral-800">{fmtDate(p.orderDate)}</span>
                <span className="text-right">{usd(p.total)}</span>
                <span>
                  <Chip>{l.po}</Chip>
                </span>
                <span>
                  <Pill label={l.pay} />
                </span>
                <span>
                  <Pill label={l.prod} />
                </span>
                <span>
                  <Pill label={l.ship} />
                </span>
                <span>
                  <Pill label={l.customs} />
                </span>
                <span>{fmtDate(p.eta)}</span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <HealthDot label={l.health} />
                  <span className="truncate text-xs text-secondary">{p.poStatus === "CLOSED" ? "Closed" : p.healthReason}</span>
                </span>
              </Link>
            );
          })}
          {rows.length === 0 && <div className="py-12 text-[15px] text-secondary">{empty}</div>}
        </div>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((p) => {
          const l = poLabels(p);
          return (
            <Link key={p.id} href={`/orders/${p.number}`} className="card flex flex-col gap-2 p-4!">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{p.number}</div>
                  <div className="text-xs text-secondary">
                    {p.supplier.name} · {fmtDate(p.orderDate)}
                  </div>
                </div>
                <div className="text-right font-semibold">{usd(p.total)}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Pill label={l.pay} />
                <Pill label={l.prod} />
                <Pill label={l.ship} />
                {p.customsStatus !== "NOT_STARTED" && <Pill label={l.customs} />}
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <HealthDot label={l.health} />
                <span className="truncate text-xs text-secondary">{p.healthReason}</span>
              </div>
            </Link>
          );
        })}
        {rows.length === 0 && <div className="py-8 text-[15px] text-secondary">{empty}</div>}
      </div>
    </>
  );
}
