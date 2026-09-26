// Applies the rules engine (lib/domain/notifications) to the database:
// creates notifications that should exist (once per dedupeKey, even after being resolved)
// and resolves rule notifications whose condition has cleared.

import { toIsoDate, type IsoDate } from "@/lib/dates";
import { firstMissingDoc } from "@/lib/domain/customs";
import { notificationsFor, RULE_PREFIX, type NotificationCandidate } from "@/lib/domain/notifications";
import { num, type Db } from "../recalc";

export async function syncNotifications(db: Db, today: IsoDate, now: Date, poIds?: string[]) {
  const pos = await db.purchaseOrder.findMany({
    where: { ...(poIds ? { id: { in: poIds } } : {}), poStatus: { in: ["SENT", "CONFIRMED"] } },
    select: {
      id: true, number: true, poStatus: true, paymentStatus: true, productionStatus: true, shipmentStatus: true, customsStatus: true,
      health: true, healthReason: true, productionNote: true, sentAt: true, eta: true, plannedCarrier: true,
      supplier: { select: { name: true } },
      payments: { where: { paidDate: null }, select: { id: true, type: true, amount: true, dueDate: true } },
      shipments: { orderBy: { createdAt: "desc" }, select: { carrier: true, trackingNumber: true, eta: true, customsDocuments: { select: { type: true, status: true } } } },
    },
  });

  const wanted = new Map<string, NotificationCandidate & { poId: string }>();
  for (const po of pos) {
    const sh = po.shipments[0];
    const candidates = notificationsFor(
      {
        number: po.number,
        supplier: po.supplier.name,
        poStatus: po.poStatus,
        paymentStatus: po.paymentStatus,
        productionStatus: po.productionStatus,
        shipmentStatus: po.shipmentStatus,
        customsStatus: po.customsStatus,
        health: po.health,
        healthReason: po.healthReason,
        productionNote: po.productionNote,
        sentAt: po.sentAt,
        eta: toIsoDate(sh?.eta ?? po.eta),
        carrier: sh?.carrier ?? po.plannedCarrier,
        trackingNumber: sh?.trackingNumber ?? null,
        missingCustomsDoc: firstMissingDoc(po.shipments.flatMap((s) => s.customsDocuments)),
        unpaidPayments: po.payments.map((p) => ({ id: p.id, type: p.type, amount: num(p.amount), dueDate: toIsoDate(p.dueDate) })),
      },
      today,
      now,
    );
    for (const c of candidates) wanted.set(c.dedupeKey, { ...c, poId: po.id });
  }

  // Existing rule notifications in scope (all POs when unscoped).
  const existing = await db.notification.findMany({
    where: { dedupeKey: { startsWith: RULE_PREFIX }, ...(poIds ? { poId: { in: poIds } } : {}) },
    select: { id: true, dedupeKey: true, resolvedAt: true },
  });
  const existingKeys = new Set(existing.map((e) => e.dedupeKey));

  const toCreate = [...wanted.values()].filter((w) => !existingKeys.has(w.dedupeKey));
  if (toCreate.length) {
    await db.notification.createMany({
      data: toCreate.map((w) => ({ tone: w.tone, kind: w.kind, title: w.title, detail: w.detail, poId: w.poId, dedupeKey: w.dedupeKey, createdAt: now })),
      skipDuplicates: true,
    });
  }

  const stale = existing.filter((e) => !e.resolvedAt && !wanted.has(e.dedupeKey!)).map((e) => e.id);
  if (stale.length) await db.notification.updateMany({ where: { id: { in: stale } }, data: { resolvedAt: now } });

  return { created: toCreate.length, autoResolved: stale.length };
}
