import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { toIsoDate, type IsoDate } from "@/lib/dates";
import { budgetBucket } from "@/lib/domain/budget";
import { firstMissingDoc } from "@/lib/domain/customs";
import { poStage, type Stage } from "@/lib/domain/orders";
import { derivePaymentState } from "@/lib/domain/payments";
import { lineTotal } from "@/lib/domain/totals";
import { num } from "@/server/recalc";

const summaryInclude = {
  supplier: { select: { id: true, name: true, city: true, country: true } },
  brand: { select: { id: true, name: true } },
  items: {
    select: {
      qtyOrdered: true, qtyReceived: true, unitPrice: true, discountPct: true, taxPct: true,
      product: { select: { id: true, sku: true, name: true, category: true } },
    },
  },
  payments: { select: { amount: true, dueDate: true, paidDate: true } },
  shipments: {
    orderBy: { createdAt: "desc" },
    select: { carrier: true, trackingNumber: true, eta: true, shipDate: true, actualArrival: true, customsDocuments: { select: { type: true, status: true } } },
  },
} satisfies Prisma.PurchaseOrderInclude;

type Row = Prisma.PurchaseOrderGetPayload<{ include: typeof summaryInclude }>;

export interface PoSummary {
  id: string;
  number: string;
  supplier: { id: string; name: string; origin: string; country: string };
  brand: { id: string; name: string };
  currency: string;
  orderDate: IsoDate;
  eta: IsoDate | null;
  poStatus: Row["poStatus"];
  paymentStatus: Row["paymentStatus"];
  productionStatus: Row["productionStatus"];
  shipmentStatus: Row["shipmentStatus"];
  customsStatus: Row["customsStatus"];
  inventoryStatus: Row["inventoryStatus"];
  health: Row["health"];
  healthReason: string;
  total: number;
  paid: number;
  outstanding: number;
  nextDueDate: IsoDate | null;
  units: number;
  unitsReceived: number;
  stage: Stage | null;
  budgetBucket: ReturnType<typeof budgetBucket>;
  carrier: string | null;
  trackingNumber: string | null;
  missingCustomsDoc: string | null;
  items: { sku: string; name: string; category: string; productId: string; qty: number; qtyReceived: number; total: number }[];
}

export function origin(s: { city: string | null; country: string }) {
  return s.city && s.city !== s.country ? `${s.city}, ${s.country}` : s.country;
}

function toSummary(po: Row, today: IsoDate): PoSummary {
  const items = po.items.map((i) => ({
    sku: i.product.sku,
    name: i.product.name,
    category: i.product.category,
    productId: i.product.id,
    qty: i.qtyOrdered,
    qtyReceived: i.qtyReceived,
    total: lineTotal({ qty: i.qtyOrdered, unitPrice: num(i.unitPrice), discountPct: num(i.discountPct), taxPct: num(i.taxPct) }),
  }));
  const total = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100;
  const pay = derivePaymentState(
    po.payments.map((p) => ({ amount: num(p.amount), dueDate: toIsoDate(p.dueDate), paidDate: toIsoDate(p.paidDate) })),
    total,
    today,
  );
  const sh = po.shipments[0];
  return {
    id: po.id,
    number: po.number,
    supplier: { id: po.supplier.id, name: po.supplier.name, origin: origin(po.supplier), country: po.supplier.country },
    brand: po.brand,
    currency: po.currency,
    orderDate: toIsoDate(po.orderDate),
    eta: toIsoDate(sh?.eta ?? po.eta),
    poStatus: po.poStatus,
    paymentStatus: po.paymentStatus,
    productionStatus: po.productionStatus,
    shipmentStatus: po.shipmentStatus,
    customsStatus: po.customsStatus,
    inventoryStatus: po.inventoryStatus,
    health: po.health,
    healthReason: po.healthReason,
    total,
    paid: pay.paid,
    outstanding: pay.outstanding,
    nextDueDate: pay.nextDueDate,
    units: items.reduce((s, i) => s + i.qty, 0),
    unitsReceived: items.reduce((s, i) => s + i.qtyReceived, 0),
    stage: poStage(po, pay.nextDueDate, today),
    budgetBucket: budgetBucket(po),
    carrier: sh?.carrier ?? po.plannedCarrier,
    trackingNumber: sh?.trackingNumber ?? null,
    missingCustomsDoc: firstMissingDoc(po.shipments.flatMap((s) => s.customsDocuments)),
    items,
  };
}

/** Normalized PO rows for lists, dashboards and analytics. */
export async function poSummaries(where: Prisma.PurchaseOrderWhereInput, today: IsoDate): Promise<PoSummary[]> {
  const rows = await db.purchaseOrder.findMany({ where, include: summaryInclude, orderBy: { orderDate: "desc" } });
  return rows.map((r) => toSummary(r, today));
}

export const yearRange = (year: number) => ({ gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) });

/** Counts toward spend: everything except drafts and cancelled. */
export const countsAsSpend = (p: { poStatus: string }) => p.poStatus !== "DRAFT" && p.poStatus !== "CANCELLED";
export const isOpenPo = (p: { poStatus: string }) => p.poStatus !== "CLOSED" && p.poStatus !== "CANCELLED";
