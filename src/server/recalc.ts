// Recompute a PO's derived fields (payment status, production delay, health).
// Used by every mutation service, the daily job and the seed script.
// No "server-only" import here so tsx scripts (seed, jobs) can use it too.

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { toIsoDate, type IsoDate } from "@/lib/dates";
import { firstMissingDoc } from "@/lib/domain/customs";
import { computeHealth } from "@/lib/domain/health";
import { derivePaymentState } from "@/lib/domain/payments";
import { deriveProductionStatus } from "@/lib/domain/production";
import { poTotal } from "@/lib/domain/totals";

export type Db = PrismaClient | Prisma.TransactionClient;

export const num = (d: { toNumber(): number } | number | null | undefined): number =>
  d == null ? 0 : typeof d === "number" ? d : d.toNumber();

export const recalcInclude = {
  items: { select: { qtyOrdered: true, unitPrice: true, discountPct: true, taxPct: true } },
  payments: { select: { amount: true, dueDate: true, paidDate: true } },
  shipments: { select: { customsDocuments: { select: { type: true, status: true } } } },
} as const;

type PoForRecalc = Prisma.PurchaseOrderGetPayload<{ include: typeof recalcInclude }>;

export function derivedFields(po: PoForRecalc, today: IsoDate) {
  const total = poTotal(
    po.items.map((i) => ({ qty: i.qtyOrdered, unitPrice: num(i.unitPrice), discountPct: num(i.discountPct), taxPct: num(i.taxPct) })),
  );
  const pay = derivePaymentState(
    po.payments.map((p) => ({ amount: num(p.amount), dueDate: toIsoDate(p.dueDate), paidDate: toIsoDate(p.paidDate) })),
    total,
    today,
  );
  const active = po.poStatus !== "CLOSED" && po.poStatus !== "CANCELLED" && po.poStatus !== "DRAFT";
  // Drafts and closed POs keep whatever payment status they have unless money has moved.
  const paymentStatus = active || pay.paid > 0 ? pay.status : po.paymentStatus;
  const productionStatus = active && po.poStatus === "CONFIRMED" ? deriveProductionStatus(po.productionStatus, toIsoDate(po.expectedProductionDate), today) : po.productionStatus;
  const missingCustomsDoc = firstMissingDoc(po.shipments.flatMap((s) => s.customsDocuments));
  const { health, reason } = computeHealth(
    {
      poStatus: po.poStatus,
      paymentStatus,
      productionStatus,
      customsStatus: po.customsStatus,
      eta: toIsoDate(po.eta),
      overdueSince: pay.overdueSince,
      nextDueDate: pay.nextDueDate,
      missingCustomsDoc,
      received: po.inventoryStatus === "RECEIVED" || po.inventoryStatus === "STOCKED",
    },
    today,
  );
  return { total, pay, paymentStatus, productionStatus, health, healthReason: reason, missingCustomsDoc };
}

/** Recompute and store derived fields. Returns what changed (for logging). */
export async function recalcPo(db: Db, poId: string, today: IsoDate) {
  const po = await db.purchaseOrder.findUniqueOrThrow({ where: { id: poId }, include: recalcInclude });
  const d = derivedFields(po, today);
  const changes: Record<string, [string, string]> = {};
  if (d.paymentStatus !== po.paymentStatus) changes.paymentStatus = [po.paymentStatus, d.paymentStatus];
  if (d.productionStatus !== po.productionStatus) changes.productionStatus = [po.productionStatus, d.productionStatus];
  if (d.health !== po.health) changes.health = [po.health, d.health];
  if (d.healthReason !== po.healthReason) changes.healthReason = [po.healthReason, d.healthReason];
  if (Object.keys(changes).length) {
    await db.purchaseOrder.update({
      where: { id: poId },
      data: { paymentStatus: d.paymentStatus, productionStatus: d.productionStatus, health: d.health, healthReason: d.healthReason },
    });
  }
  return { number: po.number, changes, derived: d };
}

/** Recompute lead time and on-time rate from the supplier's completed orders. */
export async function refreshSupplierStats(db: Db, supplierId: string) {
  const { supplierPerformance } = await import("@/lib/domain/suppliers");
  const shipments = await db.shipment.findMany({
    where: { actualArrival: { not: null }, po: { supplierId, poStatus: { not: "CANCELLED" } } },
    select: { actualArrival: true, po: { select: { orderDate: true, eta: true } } },
  });
  const perf = supplierPerformance(
    shipments.map((s) => ({ orderDate: toIsoDate(s.po.orderDate), eta: toIsoDate(s.po.eta), arrivedAt: toIsoDate(s.actualArrival!) })),
  );
  if (perf.completed > 0) {
    await db.supplier.update({ where: { id: supplierId }, data: { leadTimeDays: perf.leadTimeDays, onTimeRate: perf.onTimeRate } });
  }
  return perf;
}
