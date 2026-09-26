// Notification rules engine. Pure: takes a snapshot of each open PO and returns the
// notifications that should currently exist. The job layer inserts new ones (by dedupeKey)
// and resolves rule notifications whose condition no longer holds.

import type { CustomsStatus, Health, NotificationTone, PaymentStatus, PaymentType, PoStatus, ProductionStatus, ShipmentStatus } from "@/generated/prisma/enums";
import { daysBetween, type IsoDate } from "../dates";
import { fmtDate, usd } from "../format";

export interface NotificationPoInput {
  number: string;
  supplier: string;
  poStatus: PoStatus;
  paymentStatus: PaymentStatus;
  productionStatus: ProductionStatus;
  shipmentStatus: ShipmentStatus;
  customsStatus: CustomsStatus;
  health: Health;
  healthReason: string;
  productionNote: string | null;
  sentAt: Date | null;
  eta: IsoDate | null;
  carrier: string | null;
  trackingNumber: string | null;
  missingCustomsDoc: string | null;
  unpaidPayments: { id: string; type: PaymentType; amount: number; dueDate: IsoDate }[];
}

export interface NotificationCandidate {
  dedupeKey: string;
  tone: NotificationTone;
  kind: "Delay" | "Payment" | "Confirmation" | "Customs" | "Shipment";
  title: string;
  detail: string;
  poNumber: string;
}

/** Keys created by this engine start with "rule:" so the job only auto-resolves its own. */
export const RULE_PREFIX = "rule:";

const paymentName = (t: PaymentType) => (t === "DEPOSIT" ? "Deposit" : t === "BALANCE" ? "Balance" : "Payment");

export function notificationsFor(po: NotificationPoInput, today: IsoDate, now: Date): NotificationCandidate[] {
  const out: NotificationCandidate[] = [];
  const key = (...parts: string[]) => RULE_PREFIX + parts.join(":");

  // Delayed (overdue payment has its own notification).
  if (po.health === "DELAYED" && po.paymentStatus !== "OVERDUE") {
    const note = po.productionStatus === "DELAYED" && po.productionNote ? ` ${po.productionNote}` : "";
    out.push({
      dedupeKey: key("delay", po.number, po.healthReason),
      tone: "RED",
      kind: "Delay",
      title: `PO #${po.number} is delayed`,
      detail: `${po.healthReason}.${note}`,
      poNumber: po.number,
    });
  }

  for (const p of po.unpaidPayments) {
    const d = daysBetween(today, p.dueDate);
    if (d < 0) {
      out.push({
        dedupeKey: key("pay-overdue", p.id),
        tone: "RED",
        kind: "Payment",
        title: `Payment for PO #${po.number} is overdue`,
        detail: `${paymentName(p.type)} of ${usd(p.amount)} was due ${fmtDate(p.dueDate)}.`,
        poNumber: po.number,
      });
    } else if (d <= 1) {
      out.push({
        dedupeKey: key("pay-due", p.id),
        tone: "ORANGE",
        kind: "Payment",
        title: `Payment for PO #${po.number} is due ${d === 0 ? "today" : "tomorrow"}`,
        detail: `${paymentName(p.type)} of ${usd(p.amount)} due ${fmtDate(p.dueDate)}.`,
        poNumber: po.number,
      });
    }
  }

  if (po.poStatus === "SENT" && po.sentAt && now.getTime() - po.sentAt.getTime() > 48 * 3_600_000) {
    out.push({
      dedupeKey: key("confirm", po.number),
      tone: "ORANGE",
      kind: "Confirmation",
      title: `Supplier confirmation pending for PO #${po.number}`,
      detail: `PO sent ${fmtDate(po.sentAt.toISOString().slice(0, 10))}. No response yet.`,
      poNumber: po.number,
    });
  }

  if (po.customsStatus === "DOCUMENTS_REQUIRED") {
    const doc = po.missingCustomsDoc ?? "Customs documents";
    out.push({
      dedupeKey: key("customs", po.number, doc),
      tone: "ORANGE",
      kind: "Customs",
      title: `Customs documents required for PO #${po.number}`,
      detail: `${doc} missing.${po.eta ? ` Shipment lands ${fmtDate(po.eta)}.` : ""}`,
      poNumber: po.number,
    });
  }

  if ((po.shipmentStatus === "SHIPPED" || po.shipmentStatus === "IN_TRANSIT") && po.eta) {
    const d = daysBetween(today, po.eta);
    if (d >= 0 && d <= 2) {
      out.push({
        dedupeKey: key("arrival", po.number, po.eta),
        tone: "BLUE",
        kind: "Shipment",
        title: `Shipment #${po.number} is arriving ${d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`}`,
        detail: [po.carrier, po.trackingNumber].filter(Boolean).join(" · "),
        poNumber: po.number,
      });
    }
  }

  return out;
}
