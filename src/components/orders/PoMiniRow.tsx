import Link from "next/link";
import { HealthDot, Pill } from "@/components/ui/Pill";
import { usd } from "@/lib/format";
import { poLabels } from "@/lib/status";
import type { PoSummary } from "@/server/queries/pos";

/** Compact PO row: number, value, payment, production, shipment, health. */
export function PoMiniRow({ po }: { po: PoSummary }) {
  const l = poLabels(po);
  return (
    <Link
      href={`/orders/${po.number}`}
      className="grid items-center gap-3 border-b border-neutral-200 py-3 text-sm hover:bg-surface max-md:grid-cols-2! max-md:gap-y-2"
      style={{ gridTemplateColumns: "96px 90px 1fr 1fr 1fr 150px" }}
    >
      <b>{po.number}</b>
      <span>{usd(po.total)}</span>
      <span>
        <Pill label={l.pay} />
      </span>
      <span>
        <Pill label={l.prod} />
      </span>
      <span>
        <Pill label={l.ship} />
      </span>
      <HealthDot label={l.health} />
    </Link>
  );
}
