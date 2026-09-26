// Order health. Rules from design/README.md → "Order health"; first match wins.

import type { CustomsStatus, Health, PaymentStatus, PoStatus, ProductionStatus } from "@/generated/prisma/enums";
import { daysBetween, type IsoDate } from "../dates";
import { fmtDate } from "../format";

export interface HealthInput {
  poStatus: PoStatus;
  paymentStatus: PaymentStatus;
  productionStatus: ProductionStatus;
  customsStatus: CustomsStatus;
  eta: IsoDate | null;
  /** Earliest due date among unpaid payments that are past due. */
  overdueSince: IsoDate | null;
  /** Earliest due date among unpaid payments that are not yet past due. */
  nextDueDate: IsoDate | null;
  /** Display name of the first missing customs document, e.g. "Certificate of origin". */
  missingCustomsDoc: string | null;
  /** All goods received (inventory RECEIVED or STOCKED). */
  received?: boolean;
}

export interface HealthResult {
  health: Health;
  reason: string;
}

export function computeHealth(p: HealthInput, today: IsoDate): HealthResult {
  if (p.paymentStatus === "OVERDUE") {
    return { health: "DELAYED", reason: p.overdueSince ? `Balance overdue since ${fmtDate(p.overdueSince)}` : "Payment overdue" };
  }
  if (p.productionStatus === "DELAYED") return { health: "DELAYED", reason: "Production past expected date" };
  if (p.customsStatus === "ON_HOLD") return { health: "DELAYED", reason: "Held at customs" };
  if (p.poStatus === "DRAFT") return { health: "NEEDS_ATTENTION", reason: "Draft not sent to supplier" };
  if (p.poStatus === "SENT") return { health: "NEEDS_ATTENTION", reason: "Awaiting supplier confirmation" };
  if (p.customsStatus === "DOCUMENTS_REQUIRED") {
    return { health: "NEEDS_ATTENTION", reason: `${p.missingCustomsDoc ?? "Customs documents"} missing` };
  }
  if (p.paymentStatus === "PARTIALLY_PAID" && p.nextDueDate) {
    const d = daysBetween(today, p.nextDueDate);
    if (d <= 3) {
      return { health: "NEEDS_ATTENTION", reason: d <= 0 ? "Balance due today" : `Balance due in ${d} ${d === 1 ? "day" : "days"}` };
    }
  }
  if (p.received) return { health: "ON_TRACK", reason: "All goods received" };
  return { health: "ON_TRACK", reason: p.eta ? `ETA ${fmtDate(p.eta)}` : "Progressing to plan" };
}
