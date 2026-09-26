import "server-only";
import { db } from "@/lib/db";
import { toIsoDate, type IsoDate } from "@/lib/dates";
import { customsCosts, CUSTOMS_DOC_ORDER } from "@/lib/domain/customs";
import { derivePaymentState } from "@/lib/domain/payments";
import { lineTotal } from "@/lib/domain/totals";
import { num } from "@/server/recalc";
import { origin } from "./pos";

export async function getPoDetail(number: string, today: IsoDate) {
  const po = await db.purchaseOrder.findUnique({
    where: { number },
    include: {
      supplier: true,
      brand: true,
      items: { include: { product: true }, orderBy: { id: "asc" } },
      payments: { include: { receipt: true }, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] },
      shipments: {
        orderBy: { createdAt: "desc" },
        include: {
          milestoneEvents: true,
          customsDocuments: { include: { document: true } },
          customsCost: true,
        },
      },
      documents: { orderBy: { createdAt: "desc" } },
      activity: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!po) return null;

  const items = po.items.map((i) => ({
    id: i.id,
    sku: i.product.sku,
    name: i.product.name,
    qty: i.qtyOrdered,
    received: i.qtyReceived,
    unitPrice: num(i.unitPrice),
    discountPct: num(i.discountPct),
    taxPct: num(i.taxPct),
    total: lineTotal({ qty: i.qtyOrdered, unitPrice: num(i.unitPrice), discountPct: num(i.discountPct), taxPct: num(i.taxPct) }),
  }));
  const total = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100;
  const payments = po.payments.map((p) => {
    const dueDate = toIsoDate(p.dueDate);
    const paidDate = toIsoDate(p.paidDate);
    return {
      id: p.id,
      type: p.type,
      amount: num(p.amount),
      dueDate,
      paidDate,
      method: p.method,
      bankReference: p.bankReference,
      notes: p.notes,
      status: paidDate ? ("Paid" as const) : dueDate < today ? ("Overdue" as const) : ("Pending" as const),
      receipt: p.receipt ? { id: p.receipt.id, fileName: p.receipt.fileName } : null,
    };
  });
  const pay = derivePaymentState(payments.map((p) => ({ amount: p.amount, dueDate: p.dueDate, paidDate: p.paidDate })), total, today);

  const sh = po.shipments[0] ?? null;
  const shipment = sh && {
    id: sh.id,
    carrier: sh.carrier,
    trackingNumber: sh.trackingNumber,
    trackingUrl: sh.trackingUrl,
    origin: sh.origin ?? origin(po.supplier),
    destination: sh.destination,
    shipDate: toIsoDate(sh.shipDate),
    eta: toIsoDate(sh.eta),
    actualArrival: toIsoDate(sh.actualArrival),
    shippingCost: sh.shippingCost == null ? null : num(sh.shippingCost),
    milestone: sh.milestone,
    events: Object.fromEntries(sh.milestoneEvents.map((e) => [e.milestone, toIsoDate(e.occurredAt)])) as Partial<Record<typeof sh.milestone, IsoDate>>,
    customsDocuments: CUSTOMS_DOC_ORDER.map((t) => sh.customsDocuments.find((d) => d.type === t)).filter(Boolean).map((d) => ({
      id: d!.id,
      type: d!.type,
      status: d!.status,
      document: d!.document ? { id: d!.document.id, fileName: d!.document.fileName } : null,
    })),
    customsCost: sh.customsCost ? { duty: num(sh.customsCost.duty), importVat: num(sh.customsCost.importVat), clearanceCharges: num(sh.customsCost.clearanceCharges) } : null,
  };
  const goodsValue = total;
  const costs = customsCosts(goodsValue, shipment?.customsCost);

  return {
    id: po.id,
    number: po.number,
    supplier: { id: po.supplier.id, name: po.supplier.name, email: po.supplier.email, contactName: po.supplier.contactName, origin: origin(po.supplier) },
    brand: po.brand,
    currency: po.currency,
    orderDate: toIsoDate(po.orderDate),
    paymentTerms: po.paymentTerms,
    incoterm: po.incoterm,
    plannedCarrier: po.plannedCarrier,
    notes: po.notes,
    expectedProductionDate: toIsoDate(po.expectedProductionDate),
    expectedShipDate: toIsoDate(po.expectedShipDate),
    eta: toIsoDate(sh?.eta ?? po.eta),
    poEta: toIsoDate(po.eta),
    productionStartedAt: toIsoDate(po.productionStartedAt),
    productionCompletedAt: toIsoDate(po.productionCompletedAt),
    productionProgressPct: po.productionProgressPct,
    productionNote: po.productionNote,
    lastSupplierUpdateAt: po.lastSupplierUpdateAt ? toIsoDate(po.lastSupplierUpdateAt) : null,
    sentAt: po.sentAt ? toIsoDate(po.sentAt) : null,
    confirmedAt: po.confirmedAt ? toIsoDate(po.confirmedAt) : null,
    closedAt: po.closedAt ? toIsoDate(po.closedAt) : null,
    createdAt: toIsoDate(po.createdAt),
    poStatus: po.poStatus,
    paymentStatus: po.paymentStatus,
    productionStatus: po.productionStatus,
    shipmentStatus: po.shipmentStatus,
    customsStatus: po.customsStatus,
    inventoryStatus: po.inventoryStatus,
    health: po.health,
    healthReason: po.healthReason,
    items,
    total,
    units: items.reduce((s, i) => s + i.qty, 0),
    received: items.reduce((s, i) => s + i.received, 0),
    payments,
    pay,
    shipment,
    costs,
    documents: po.documents.map((d) => ({ id: d.id, type: d.type, title: d.title, fileName: d.fileName, date: toIsoDate(d.createdAt) })),
    activity: po.activity.map((a) => ({ id: a.id, date: toIsoDate(a.createdAt), who: a.actorLabel, text: a.text, kind: a.kind })),
  };
}

export type PoDetail = NonNullable<Awaited<ReturnType<typeof getPoDetail>>>;
