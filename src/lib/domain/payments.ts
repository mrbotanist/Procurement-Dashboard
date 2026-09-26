// Payment status derived from Payment rows. See CLAUDE.md → "Payment status".

import type { PaymentStatus } from "@/generated/prisma/enums";
import type { IsoDate } from "../dates";

export interface PaymentRow {
  amount: number;
  dueDate: IsoDate;
  paidDate: IsoDate | null;
  type?: "DEPOSIT" | "BALANCE" | "OTHER";
}

export interface PaymentState {
  status: PaymentStatus;
  paid: number;
  outstanding: number;
  /** Earliest due date among unpaid payments already past due. */
  overdueSince: IsoDate | null;
  /** Earliest due date among unpaid payments not yet past due. */
  nextDueDate: IsoDate | null;
  /** "Deposit" / "Balance" / "Payment" for the earliest overdue payment. */
  overdueLabel: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * - paid ≥ total → PAID
 * - any unpaid payment past its due date → OVERDUE (also when partly paid: the
 *   daily job "sets OVERDUE when an unpaid payment passes its due date")
 * - 0 < paid < total → PARTIALLY_PAID
 * - otherwise → PENDING
 */
export function derivePaymentState(payments: PaymentRow[], total: number, today: IsoDate): PaymentState {
  const paid = round2(payments.filter((p) => p.paidDate).reduce((s, p) => s + p.amount, 0));
  const unpaid = payments.filter((p) => !p.paidDate).map((p) => p.dueDate).sort();
  const overdueSince = unpaid.find((d) => d < today) ?? null;
  const nextDueDate = unpaid.find((d) => d >= today) ?? null;
  const outstanding = Math.max(0, round2(total - paid));

  let status: PaymentStatus;
  if (total > 0 && paid >= total) status = "PAID";
  else if (overdueSince) status = "OVERDUE";
  else if (paid > 0) status = "PARTIALLY_PAID";
  else status = "PENDING";

  const overdueRow = overdueSince ? payments.find((p) => !p.paidDate && p.dueDate === overdueSince) : undefined;
  const overdueLabel = overdueRow ? (overdueRow.type === "DEPOSIT" ? "Deposit" : overdueRow.type === "OTHER" ? "Payment" : "Balance") : null;
  return {
    status,
    paid,
    outstanding,
    overdueSince: status === "PAID" ? null : overdueSince,
    nextDueDate: status === "PAID" ? null : nextDueDate,
    overdueLabel: status === "PAID" ? null : overdueLabel,
  };
}

/**
 * Default schedule for a new PO from the supplier's terms text, e.g.
 * "50% deposit, 50% before shipment" → deposit 50% due on order, balance 50% due before the ship date.
 * "100% before shipment" / "100% on order" → one payment.
 */
export function defaultSchedule(
  terms: string | null | undefined,
  total: number,
  orderDate: IsoDate,
  shipDate: IsoDate | null,
  addDays: (d: IsoDate, n: number) => IsoDate,
): { type: "DEPOSIT" | "BALANCE"; amount: number; dueDate: IsoDate }[] {
  const t = (terms ?? "").toLowerCase();
  const pct = Number(t.match(/(\d{1,3})\s*%\s*deposit/)?.[1] ?? (t.includes("100%") ? 100 : 50));
  const beforeShip = shipDate ? addDays(shipDate, -2) : addDays(orderDate, 10);
  const balanceDays = Number(t.match(/balance in (\d+) days/)?.[1] ?? NaN);
  const balanceDue = Number.isFinite(balanceDays) ? addDays(orderDate, balanceDays) : beforeShip;

  if (pct >= 100) {
    const onOrder = t.includes("on order");
    return [{ type: "BALANCE", amount: round2(total), dueDate: onOrder ? addDays(orderDate, 1) : beforeShip }];
  }
  const deposit = round2((total * pct) / 100);
  return [
    { type: "DEPOSIT", amount: deposit, dueDate: addDays(orderDate, 1) },
    { type: "BALANCE", amount: round2(total - deposit), dueDate: balanceDue },
  ];
}
