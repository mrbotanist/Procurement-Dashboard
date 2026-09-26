"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import type { ShipmentMilestone, ShipmentStatus } from "@/generated/prisma/enums";
import { addDays, fromIsoDate, toIsoDate } from "@/lib/dates";
import { CUSTOMS_DOC_LABEL, CUSTOMS_DOC_ORDER, deriveCustomsStatus } from "@/lib/domain/customs";
import { defaultSchedule } from "@/lib/domain/payments";
import { poTotal } from "@/lib/domain/totals";
import { fmtDate, usd } from "@/lib/format";
import {
  CUSTOMS_STATUS_LABEL,
  DOCUMENT_TYPE_LABEL,
  MILESTONE_LABEL,
  PAYMENT_TYPE_LABEL,
  PRODUCTION_STATUS_LABEL,
} from "@/lib/status";
import { saveUpload, StorageError } from "@/lib/storage";
import {
  cancelSchema,
  createPoSchema,
  customsCostSchema,
  customsDocSchema,
  customsStatusSchema,
  editPoSchema,
  milestoneSchema,
  MILESTONES,
  noteSchema,
  poIdSchema,
  productionSchema,
  receiveSchema,
  recordPaymentSchema,
  schedulePaymentSchema,
  shipmentSchema,
  uploadSchema,
} from "@/lib/validation/po";
import type { CurrentUser } from "@/lib/auth/session";
import { syncNotifications } from "@/server/jobs/notifications";
import { recalcPo, refreshSupplierStats } from "@/server/recalc";
import { diff, formToObject, logActivity, runService, UserError, type ActionResult } from "./base";

type Tx = Prisma.TransactionClient;
const D = fromIsoDate;

/** Derived fields + notifications after any change to a PO. */
async function afterChange(tx: Tx, poId: string, today: string, now: Date) {
  const r = await recalcPo(tx, poId, today);
  await syncNotifications(tx, today, now, [poId]);
  return r;
}

async function getPo(tx: Tx, poId: string) {
  return tx.purchaseOrder.findUniqueOrThrow({ where: { id: poId }, include: { supplier: true } });
}

function revalidatePo(number?: string) {
  if (number) revalidatePath(`/orders/${number}`);
  revalidatePath("/", "layout");
}

async function storeFile(tx: Tx, user: CurrentUser, file: File, data: { poId?: string; supplierId?: string; shipmentId?: string; type: Prisma.DocumentCreateInput["type"]; title?: string }) {
  const saved = await saveUpload(file, data.poId ?? data.supplierId ?? "misc");
  return tx.document.create({
    data: {
      poId: data.poId, supplierId: data.supplierId, shipmentId: data.shipmentId, type: data.type, title: data.title,
      fileName: saved.fileName, storageKey: saved.storageKey, mimeType: saved.mimeType, size: saved.size, uploadedById: user.id,
    },
  });
}

const fileFrom = (fd: FormData, key = "file") => {
  const f = fd.get(key);
  return f instanceof File && f.size > 0 ? f : null;
};

function handleStorage<T>(p: Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  return p.catch((e) => (e instanceof StorageError ? { ok: false as const, error: e.message } : Promise.reject(e)));
}

// ─── Create ──────────────────────────────────────────────────────────────────

/** Next PO number: supplier prefix + next number in the shared sequence (GE-26091 → XX-26092). */
async function nextNumber(tx: Tx, code: string) {
  const rows = await tx.$queryRaw<{ max: number | null }[]>`
    SELECT MAX(CAST(substring("number" from '-(\\d+)$') AS INTEGER)) AS max FROM "PurchaseOrder"`;
  return `${code}-${(rows[0]?.max ?? 26000) + 1}`;
}

export async function createPo(fd: FormData): Promise<ActionResult<{ number: string }>> {
  let payload: unknown;
  try {
    payload = JSON.parse(String(fd.get("payload") ?? "{}"));
  } catch {
    return { ok: false, error: "The form data could not be read." };
  }
  const files = fd.getAll("docs").filter((f): f is File => f instanceof File && f.size > 0);
  const fileTypes = fd.getAll("docTypes").map(String);

  const res = await handleStorage(
    runService("po:write", createPoSchema, payload, async ({ user, input, tx, today, now }) => {
      const supplier = await tx.supplier.findUniqueOrThrow({ where: { id: input.supplierId } });
      const number = await nextNumber(tx, supplier.code);

      // Resolve products; custom lines become new catalogue products under the PO's brand.
      const items: { productId: string; qtyOrdered: number; unitPrice: number; discountPct: number; taxPct: number }[] = [];
      for (const l of input.lines) {
        let productId = l.productId ?? null;
        if (!productId) {
          const existing = await tx.product.findUnique({ where: { sku: l.sku } });
          productId = existing?.id ?? (await tx.product.create({ data: { sku: l.sku, name: l.name, brandId: input.brandId, category: "Uncategorized" } })).id;
        }
        items.push({ productId, qtyOrdered: l.qty, unitPrice: l.unitPrice, discountPct: l.discountPct, taxPct: l.taxPct });
      }
      const total = poTotal(input.lines.map((l) => ({ qty: l.qty, unitPrice: l.unitPrice, discountPct: l.discountPct, taxPct: l.taxPct })));
      const eta = input.expectedShipDate ? addDays(input.expectedShipDate, 5) : null;

      const po = await tx.purchaseOrder.create({
        data: {
          number,
          supplierId: supplier.id,
          brandId: input.brandId,
          currency: input.currency,
          orderDate: D(today),
          paymentTerms: input.paymentTerms,
          incoterm: input.incoterm,
          plannedCarrier: input.carrier,
          notes: input.notes,
          expectedProductionDate: input.expectedProductionDate ? D(input.expectedProductionDate) : null,
          expectedShipDate: input.expectedShipDate ? D(input.expectedShipDate) : null,
          eta: eta ? D(eta) : null,
          poStatus: input.send ? "SENT" : "DRAFT",
          sentAt: input.send ? now : null,
          createdById: user.id,
          items: { create: items },
        },
      });
      // Payment schedule from the terms; deposits for unconfirmed POs fall due a week out.
      const schedule = defaultSchedule(input.paymentTerms, total, addDays(today, 6), input.expectedShipDate ?? null, addDays);
      for (const p of schedule) await tx.payment.create({ data: { poId: po.id, type: p.type, amount: p.amount, dueDate: D(p.dueDate) } });

      for (const [i, f] of files.entries()) {
        const type = fileTypes[i] === "PROFORMA_INVOICE" ? "PROFORMA_INVOICE" : "QUOTATION";
        await storeFile(tx, user, f, { poId: po.id, supplierId: supplier.id, type });
      }
      await logActivity(tx, user, {
        poId: po.id,
        kind: "STATUS_CHANGE",
        text: input.send ? `PO created and marked as sent to ${supplier.name} (${usd(total)}).` : `Draft created (${usd(total)}).`,
        entityType: "PurchaseOrder",
        entityId: po.id,
        after: { poStatus: po.poStatus, total, lines: input.lines.length },
      });
      await afterChange(tx, po.id, today, now);
      return { number };
    }),
  );
  if (res.ok) revalidatePo(res.data?.number);
  return res;
}

// ─── Status changes ──────────────────────────────────────────────────────────

export async function editPo(_prev: unknown, fd: FormData): Promise<ActionResult> {
  let number: string | undefined;
  const res = await runService("po:write", editPoSchema, formToObject(fd), async ({ user, input, tx, today, now }) => {
    const po = await getPo(tx, input.poId);
    number = po.number;
    const data = {
      paymentTerms: input.paymentTerms ?? null,
      incoterm: input.incoterm ?? null,
      plannedCarrier: input.plannedCarrier ?? null,
      expectedProductionDate: input.expectedProductionDate ? D(input.expectedProductionDate) : null,
      expectedShipDate: input.expectedShipDate ? D(input.expectedShipDate) : null,
      eta: input.eta ? D(input.eta) : null,
      notes: input.notes ?? null,
    };
    const d = diff(po as unknown as Record<string, unknown>, data);
    if (!d.changed.length) return undefined;
    await tx.purchaseOrder.update({ where: { id: po.id }, data });
    // A new, later expected date lifts a production delay.
    if (po.productionStatus === "DELAYED" && input.expectedProductionDate && input.expectedProductionDate >= today) {
      await tx.purchaseOrder.update({ where: { id: po.id }, data: { productionStatus: "IN_PRODUCTION" } });
    }
    await logActivity(tx, user, { poId: po.id, text: `Updated ${d.changed.join(", ")}.`, entityType: "PurchaseOrder", entityId: po.id, before: d.before as never, after: d.after as never });
    await afterChange(tx, po.id, today, now);
    return undefined;
  });
  if (res.ok) revalidatePo(number);
  return res;
}

async function transition(
  poId: string,
  guard: (po: Awaited<ReturnType<typeof getPo>>) => string | null,
  update: (po: Awaited<ReturnType<typeof getPo>>, now: Date) => Prisma.PurchaseOrderUpdateInput,
  text: (po: Awaited<ReturnType<typeof getPo>>) => string,
  extra?: string,
): Promise<ActionResult> {
  let number: string | undefined;
  const res = await runService("po:write", extra ? cancelSchema : poIdSchema, extra ? { poId, reason: extra } : { poId }, async ({ user, tx, today, now }) => {
    const po = await getPo(tx, poId);
    number = po.number;
    const err = guard(po);
    if (err) throw new UserError(err);
    const data = update(po, now);
    await tx.purchaseOrder.update({ where: { id: po.id }, data });
    await logActivity(tx, user, { poId: po.id, text: text(po), entityType: "PurchaseOrder", entityId: po.id, before: { poStatus: po.poStatus }, after: { poStatus: data.poStatus as string } });
    await afterChange(tx, po.id, today, now);
    return undefined;
  });
  if (res.ok) revalidatePo(number);
  return res;
}

export async function sendPo(poId: string) {
  return transition(
    poId,
    (po) => (po.poStatus === "DRAFT" ? null : "Only drafts can be sent."),
    (_po, now) => ({ poStatus: "SENT", sentAt: now }),
    (po) => `PO marked as sent to ${po.supplier.name}.`,
  );
}

export async function confirmPo(poId: string) {
  return transition(
    poId,
    (po) => (po.poStatus === "SENT" || po.poStatus === "DRAFT" ? null : "This PO is already confirmed."),
    (_po, now) => ({ poStatus: "CONFIRMED", confirmedAt: now }),
    (po) => `${po.supplier.name} confirmed the PO.`,
  );
}

export async function cancelPo(poId: string, reason: string) {
  return transition(
    poId,
    (po) => (po.poStatus === "CLOSED" || po.poStatus === "CANCELLED" ? "This PO is already closed." : po.inventoryStatus !== "NOT_RECEIVED" ? "Goods have been received; close the PO instead." : null),
    () => ({ poStatus: "CANCELLED" }),
    () => `PO cancelled. Reason: ${reason}`,
    reason,
  );
}

export async function closePo(poId: string) {
  return transition(
    poId,
    (po) => (po.inventoryStatus === "RECEIVED" || po.inventoryStatus === "STOCKED" ? (po.poStatus === "CLOSED" ? "Already closed." : null) : "Receive all goods before closing the PO."),
    (_po, now) => ({ poStatus: "CLOSED", closedAt: now }),
    () => "PO closed.",
  );
}

// ─── Notes & production ──────────────────────────────────────────────────────

async function supplierUpdateNotification(tx: Tx, po: { id: string; number: string; supplier: { name: string } }, text: string, now: Date) {
  await tx.notification.create({
    data: { tone: "BLUE", kind: "Update", title: `${po.supplier.name} posted an update on PO #${po.number}`, detail: text.slice(0, 300), poId: po.id, createdAt: now },
  });
}

export async function addNote(_prev: unknown, fd: FormData): Promise<ActionResult> {
  let number: string | undefined;
  const res = await runService("note:write", noteSchema, formToObject(fd), async ({ user, input, tx, today, now }) => {
    const po = await getPo(tx, input.poId);
    number = po.number;
    await logActivity(tx, user, { poId: po.id, kind: "NOTE", text: input.text, actorLabel: input.fromSupplier ? "Supplier" : user.name });
    if (input.fromSupplier) {
      await tx.purchaseOrder.update({ where: { id: po.id }, data: { lastSupplierUpdateAt: now } });
      await supplierUpdateNotification(tx, po, input.text, now);
      await afterChange(tx, po.id, today, now);
    }
    return undefined;
  });
  if (res.ok) revalidatePo(number);
  return res;
}

export async function updateProduction(_prev: unknown, fd: FormData): Promise<ActionResult> {
  let number: string | undefined;
  const res = await runService("po:write", productionSchema, formToObject(fd), async ({ user, input, tx, today, now }) => {
    const po = await getPo(tx, input.poId);
    number = po.number;
    if (po.poStatus === "CLOSED" || po.poStatus === "CANCELLED") throw new UserError("This PO is closed.");
    const done = input.productionStatus === "COMPLETED" || input.productionStatus === "READY";
    const data: Prisma.PurchaseOrderUpdateInput = {
      productionStatus: input.productionStatus,
      productionProgressPct: done ? 100 : input.productionProgressPct,
      expectedProductionDate: input.expectedProductionDate ? D(input.expectedProductionDate) : po.expectedProductionDate,
      productionStartedAt: input.productionStatus !== "NOT_STARTED" && !po.productionStartedAt ? D(today) : undefined,
      productionCompletedAt: done ? (po.productionCompletedAt ?? D(today)) : null,
      productionNote: input.note ?? po.productionNote,
      lastSupplierUpdateAt: input.fromSupplier ? now : undefined,
      // Goods ready at the supplier → ready to ship, unless already moving.
      shipmentStatus: done && po.shipmentStatus === "NOT_SHIPPED" ? "READY_TO_SHIP" : undefined,
    };
    await tx.purchaseOrder.update({ where: { id: po.id }, data });
    const parts = [
      po.productionStatus !== input.productionStatus ? `Production ${PRODUCTION_STATUS_LABEL[po.productionStatus]} → ${PRODUCTION_STATUS_LABEL[input.productionStatus]}` : null,
      po.productionProgressPct !== input.productionProgressPct ? `${input.productionProgressPct}% complete` : null,
      input.expectedProductionDate && input.expectedProductionDate !== toIsoDate(po.expectedProductionDate) ? `expected ${fmtDate(input.expectedProductionDate)}` : null,
    ].filter(Boolean);
    await logActivity(tx, user, {
      poId: po.id,
      kind: input.fromSupplier ? "NOTE" : "STATUS_CHANGE",
      actorLabel: input.fromSupplier ? "Supplier" : user.name,
      text: [parts.join(", ") + (parts.length ? "." : ""), input.note].filter(Boolean).join(" ") || "Production updated.",
      before: { productionStatus: po.productionStatus, productionProgressPct: po.productionProgressPct },
      after: { productionStatus: input.productionStatus, productionProgressPct: input.productionProgressPct },
    });
    if (input.fromSupplier) await supplierUpdateNotification(tx, po, input.note ?? parts.join(", "), now);
    await afterChange(tx, po.id, today, now);
    return undefined;
  });
  if (res.ok) revalidatePo(number);
  return res;
}

// ─── Payments ────────────────────────────────────────────────────────────────

export async function recordPayment(_prev: unknown, fd: FormData): Promise<ActionResult> {
  let number: string | undefined;
  const receipt = fileFrom(fd, "receipt");
  const res = await handleStorage(
    runService("payment:write", recordPaymentSchema, formToObject(fd), async ({ user, input, tx, today, now }) => {
      const po = await getPo(tx, input.poId);
      number = po.number;
      if (po.poStatus === "CANCELLED") throw new UserError("This PO is cancelled.");
      const doc = receipt ? await storeFile(tx, user, receipt, { poId: po.id, supplierId: po.supplierId, type: "PAYMENT_RECEIPT" }) : null;
      const paid = { paidDate: D(input.paidDate), method: input.method, bankReference: input.bankReference, notes: input.notes, receiptDocumentId: doc?.id };

      let label = "Payment";
      if (input.paymentId) {
        const row = await tx.payment.findFirstOrThrow({ where: { id: input.paymentId, poId: po.id } });
        if (row.paidDate) throw new UserError("That payment is already recorded.");
        label = PAYMENT_TYPE_LABEL[row.type];
        const due = Number(row.amount);
        if (input.amount > due + 0.005) throw new UserError(`${label} is ${usd(due)}; record the extra as a separate payment.`);
        await tx.payment.update({ where: { id: row.id }, data: { ...paid, amount: input.amount } });
        // Part-payment: keep the remainder scheduled on the same due date.
        if (input.amount < due - 0.005) {
          await tx.payment.create({ data: { poId: po.id, type: row.type, amount: Math.round((due - input.amount) * 100) / 100, dueDate: row.dueDate } });
        }
      } else {
        await tx.payment.create({ data: { poId: po.id, type: "OTHER", amount: input.amount, dueDate: D(input.paidDate), ...paid } });
      }
      await logActivity(tx, user, {
        poId: po.id,
        kind: "PAYMENT",
        text: `${label} of ${usd(input.amount)} recorded${input.bankReference ? `. Ref ${input.bankReference}` : ""}.`,
        entityType: "Payment",
        after: { amount: input.amount, paidDate: input.paidDate, method: input.method },
      });
      const r = await afterChange(tx, po.id, today, now);
      // Paid off an overdue balance on a paused order → production can resume.
      if (po.paymentStatus === "OVERDUE" && r.derived.paymentStatus !== "OVERDUE" && po.productionStatus === "DELAYED" && po.expectedProductionDate && toIsoDate(po.expectedProductionDate) >= today) {
        await tx.purchaseOrder.update({ where: { id: po.id }, data: { productionStatus: "IN_PRODUCTION" } });
        await afterChange(tx, po.id, today, now);
      }
      return undefined;
    }),
  );
  if (res.ok) revalidatePo(number);
  return res;
}

export async function schedulePayment(_prev: unknown, fd: FormData): Promise<ActionResult> {
  let number: string | undefined;
  const res = await runService("payment:write", schedulePaymentSchema, formToObject(fd), async ({ user, input, tx, today, now }) => {
    const po = await getPo(tx, input.poId);
    number = po.number;
    await tx.payment.create({ data: { poId: po.id, type: input.type, amount: input.amount, dueDate: D(input.dueDate) } });
    await logActivity(tx, user, { poId: po.id, kind: "PAYMENT", text: `${PAYMENT_TYPE_LABEL[input.type]} of ${usd(input.amount)} scheduled for ${fmtDate(input.dueDate)}.` });
    await afterChange(tx, po.id, today, now);
    return undefined;
  });
  if (res.ok) revalidatePo(number);
  return res;
}

export async function deleteScheduledPayment(paymentId: string): Promise<ActionResult> {
  let number: string | undefined;
  const res = await runService("payment:write", poIdSchema, { poId: paymentId }, async ({ user, tx, today, now }) => {
    const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { po: true } });
    number = p.po.number;
    if (p.paidDate) throw new UserError("Recorded payments can't be deleted.");
    await tx.payment.delete({ where: { id: p.id } });
    await logActivity(tx, user, { poId: p.poId, kind: "PAYMENT", text: `Removed scheduled ${PAYMENT_TYPE_LABEL[p.type].toLowerCase()} of ${usd(Number(p.amount))} due ${fmtDate(toIsoDate(p.dueDate))}.` });
    await afterChange(tx, p.poId, today, now);
    return undefined;
  });
  if (res.ok) revalidatePo(number);
  return res;
}

// ─── Shipments ───────────────────────────────────────────────────────────────

const MILESTONE_STATUS: Record<ShipmentMilestone, ShipmentStatus> = {
  SUPPLIER: "READY_TO_SHIP",
  PICKED_UP: "SHIPPED",
  EXPORT_CUSTOMS: "SHIPPED",
  IN_TRANSIT: "IN_TRANSIT",
  IMPORT_CUSTOMS: "IN_TRANSIT",
  DELIVERED: "DELIVERED",
};

export async function saveShipment(_prev: unknown, fd: FormData): Promise<ActionResult> {
  let number: string | undefined;
  const res = await runService("shipment:write", shipmentSchema, formToObject(fd), async ({ user, input, tx, today, now }) => {
    const po = await getPo(tx, input.poId);
    number = po.number;
    const data = {
      carrier: input.carrier,
      trackingNumber: input.trackingNumber ?? null,
      trackingUrl: input.trackingUrl ?? null,
      origin: input.origin ?? null,
      destination: input.destination ?? "Dubai, UAE",
      shipDate: input.shipDate ? D(input.shipDate) : null,
      eta: input.eta ? D(input.eta) : null,
      shippingCost: input.shippingCost ?? null,
    };
    if (input.shipmentId) {
      const before = await tx.shipment.findFirstOrThrow({ where: { id: input.shipmentId, poId: po.id } });
      const d = diff(before as unknown as Record<string, unknown>, data);
      await tx.shipment.update({ where: { id: before.id }, data });
      if (d.changed.length) await logActivity(tx, user, { poId: po.id, text: `Shipment updated: ${d.changed.join(", ")}.`, entityType: "Shipment", entityId: before.id, before: d.before as never, after: d.after as never });
    } else {
      const shipped = input.shipDate && input.shipDate <= today;
      const s = await tx.shipment.create({ data: { ...data, poId: po.id, milestone: shipped ? "PICKED_UP" : "SUPPLIER" } });
      await tx.shipmentMilestoneEvent.create({ data: { shipmentId: s.id, milestone: "SUPPLIER", occurredAt: D(input.shipDate && !shipped ? input.shipDate : today) } });
      if (shipped) await tx.shipmentMilestoneEvent.create({ data: { shipmentId: s.id, milestone: "PICKED_UP", occurredAt: D(input.shipDate!) } });
      await tx.customsDocument.createMany({ data: CUSTOMS_DOC_ORDER.map((type) => ({ shipmentId: s.id, type })) });
      await tx.purchaseOrder.update({ where: { id: po.id }, data: { shipmentStatus: shipped ? "SHIPPED" : "READY_TO_SHIP" } });
      await logActivity(tx, user, { poId: po.id, text: `Shipment created with ${input.carrier}${input.trackingNumber ? ` (${input.trackingNumber})` : ""}.`, entityType: "Shipment", entityId: s.id });
    }
    if (input.eta && input.eta !== toIsoDate(po.eta)) await tx.purchaseOrder.update({ where: { id: po.id }, data: { eta: D(input.eta) } });
    await afterChange(tx, po.id, today, now);
    return undefined;
  });
  if (res.ok) revalidatePo(number);
  return res;
}

export async function setMilestone(_prev: unknown, fd: FormData): Promise<ActionResult> {
  let number: string | undefined;
  const res = await runService("shipment:write", milestoneSchema, formToObject(fd), async ({ user, input, tx, today, now }) => {
    const s = await tx.shipment.findUniqueOrThrow({ where: { id: input.shipmentId }, include: { po: true, customsDocuments: true } });
    number = s.po.number;
    const idx = MILESTONES.indexOf(input.milestone);
    // Reaching a milestone implies the earlier ones happened.
    for (const m of MILESTONES.slice(0, idx + 1)) {
      await tx.shipmentMilestoneEvent.upsert({
        where: { shipmentId_milestone: { shipmentId: s.id, milestone: m } },
        update: m === input.milestone ? { occurredAt: D(input.date) } : {},
        create: { shipmentId: s.id, milestone: m, occurredAt: D(input.date) },
      });
    }
    await tx.shipmentMilestoneEvent.deleteMany({ where: { shipmentId: s.id, milestone: { in: MILESTONES.slice(idx + 1) as unknown as ShipmentMilestone[] } } });
    await tx.shipment.update({
      where: { id: s.id },
      data: {
        milestone: input.milestone,
        shipDate: idx >= 1 && !s.shipDate ? D(input.date) : undefined,
        actualArrival: input.milestone === "DELIVERED" ? D(input.date) : null,
      },
    });
    const poData: Prisma.PurchaseOrderUpdateInput = { shipmentStatus: MILESTONE_STATUS[input.milestone] };
    if (input.milestone === "IMPORT_CUSTOMS") {
      poData.customsStatus = deriveCustomsStatus(s.po.customsStatus === "NOT_STARTED" ? "IN_CLEARANCE" : s.po.customsStatus, s.customsDocuments, true);
    }
    if (input.milestone === "DELIVERED" && (s.po.customsStatus === "IN_CLEARANCE" || s.po.customsStatus === "NOT_STARTED")) poData.customsStatus = "CLEARED";
    await tx.purchaseOrder.update({ where: { id: s.poId }, data: poData });
    await logActivity(tx, user, { poId: s.poId, text: `Shipment milestone: ${MILESTONE_LABEL[input.milestone]} (${fmtDate(input.date)}).`, entityType: "Shipment", entityId: s.id, before: { milestone: s.milestone }, after: { milestone: input.milestone } });
    await afterChange(tx, s.poId, today, now);
    return undefined;
  });
  if (res.ok) {
    revalidatePo(number);
    revalidatePath("/shipments");
  }
  return res;
}

// ─── Customs ─────────────────────────────────────────────────────────────────

export async function setCustomsDocument(_prev: unknown, fd: FormData): Promise<ActionResult> {
  let number: string | undefined;
  const file = fileFrom(fd);
  const res = await handleStorage(
    runService("shipment:write", customsDocSchema, formToObject(fd), async ({ user, input, tx, today, now }) => {
      const cd = await tx.customsDocument.findUniqueOrThrow({ where: { id: input.customsDocumentId }, include: { shipment: { include: { po: true } } } });
      const po = cd.shipment.po;
      number = po.number;
      const status = file ? "RECEIVED" : input.status;
      let documentId = cd.documentId;
      if (file) {
        const type = cd.type === "COMMERCIAL_INVOICE" ? "COMMERCIAL_INVOICE" : cd.type === "PACKING_LIST" ? "PACKING_LIST" : cd.type === "CERTIFICATE_OF_ORIGIN" ? "CERTIFICATE_OF_ORIGIN" : "CUSTOMS";
        documentId = (await storeFile(tx, user, file, { poId: po.id, supplierId: po.supplierId, shipmentId: cd.shipmentId, type, title: CUSTOMS_DOC_LABEL[cd.type] })).id;
      }
      await tx.customsDocument.update({ where: { id: cd.id }, data: { status, documentId } });
      const docs = await tx.customsDocument.findMany({ where: { shipmentId: cd.shipmentId }, select: { status: true } });
      const atImport = cd.shipment.milestone === "IMPORT_CUSTOMS" || cd.shipment.milestone === "DELIVERED";
      const customsStatus = deriveCustomsStatus(po.customsStatus, docs, atImport);
      if (customsStatus !== po.customsStatus) await tx.purchaseOrder.update({ where: { id: po.id }, data: { customsStatus } });
      await logActivity(tx, user, {
        poId: po.id,
        text: `${CUSTOMS_DOC_LABEL[cd.type]} marked ${status.toLowerCase()}${file ? ` (${file.name} uploaded)` : ""}.${customsStatus !== po.customsStatus ? ` Customs: ${CUSTOMS_STATUS_LABEL[customsStatus]}.` : ""}`,
        entityType: "CustomsDocument",
        entityId: cd.id,
        before: { status: cd.status },
        after: { status },
      });
      await afterChange(tx, po.id, today, now);
      return undefined;
    }),
  );
  if (res.ok) {
    revalidatePo(number);
    revalidatePath("/shipments");
  }
  return res;
}

export async function setCustomsStatus(_prev: unknown, fd: FormData): Promise<ActionResult> {
  let number: string | undefined;
  const res = await runService("shipment:write", customsStatusSchema, formToObject(fd), async ({ user, input, tx, today, now }) => {
    const po = await getPo(tx, input.poId);
    number = po.number;
    if (po.customsStatus === input.customsStatus) return undefined;
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { customsStatus: input.customsStatus } });
    await logActivity(tx, user, { poId: po.id, text: `Customs status ${CUSTOMS_STATUS_LABEL[po.customsStatus]} → ${CUSTOMS_STATUS_LABEL[input.customsStatus]}.`, before: { customsStatus: po.customsStatus }, after: { customsStatus: input.customsStatus } });
    await afterChange(tx, po.id, today, now);
    return undefined;
  });
  if (res.ok) {
    revalidatePo(number);
    revalidatePath("/shipments");
  }
  return res;
}

export async function saveCustomsCosts(_prev: unknown, fd: FormData): Promise<ActionResult> {
  let number: string | undefined;
  const res = await runService("shipment:write", customsCostSchema, formToObject(fd), async ({ user, input, tx }) => {
    const s = await tx.shipment.findUniqueOrThrow({ where: { id: input.shipmentId }, include: { po: true } });
    number = s.po.number;
    const { shipmentId, ...costs } = input;
    await tx.customsCost.upsert({ where: { shipmentId }, update: costs, create: { shipmentId, ...costs } });
    await logActivity(tx, user, { poId: s.poId, text: `Customs costs entered: duty ${usd(costs.duty)}, VAT ${usd(costs.importVat)}, clearance ${usd(costs.clearanceCharges)}.`, after: costs });
    return undefined;
  });
  if (res.ok) {
    revalidatePo(number);
    revalidatePath("/shipments");
  }
  return res;
}

// ─── Receiving ───────────────────────────────────────────────────────────────

export async function receiveGoods(_prev: unknown, fd: FormData): Promise<ActionResult> {
  let number: string | undefined;
  const raw = formToObject(fd);
  const itemIds = ([] as unknown[]).concat(raw.itemId ?? []).map(String);
  const qtys = ([] as unknown[]).concat(raw.qty ?? []).map(String);
  const input = { poId: raw.poId, date: raw.date, lines: itemIds.map((itemId, i) => ({ itemId, qty: qtys[i] })) };
  const res = await runService("receiving:write", receiveSchema, input, async ({ user, input, tx, today, now }) => {
    const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: input.poId }, include: { items: { include: { product: true } }, shipments: { orderBy: { createdAt: "desc" } } } });
    number = po.number;
    if (po.poStatus !== "CONFIRMED") throw new UserError("Only confirmed orders can be received.");
    const received: string[] = [];
    for (const l of input.lines) {
      if (!l.qty) continue;
      const item = po.items.find((i) => i.id === l.itemId);
      if (!item) throw new UserError("Unknown line on this PO.");
      const remaining = item.qtyOrdered - item.qtyReceived;
      if (l.qty > remaining) throw new UserError(`${item.product.sku}: only ${remaining} left to receive.`);
      await tx.pOItem.update({ where: { id: item.id }, data: { qtyReceived: { increment: l.qty } } });
      await tx.product.update({ where: { id: item.productId }, data: { stockQty: { increment: l.qty } } });
      received.push(`${l.qty.toLocaleString()} × ${item.product.sku}`);
    }
    if (!received.length) throw new UserError("Enter at least one quantity.");
    const items = await tx.pOItem.findMany({ where: { poId: po.id } });
    const all = items.every((i) => i.qtyReceived >= i.qtyOrdered);
    const data: Prisma.PurchaseOrderUpdateInput = { inventoryStatus: all ? "RECEIVED" : "PARTIALLY_RECEIVED" };
    // Goods in the warehouse means the shipment arrived and cleared customs.
    const sh = po.shipments[0];
    if (sh && !sh.actualArrival) {
      await tx.shipment.update({ where: { id: sh.id }, data: { actualArrival: D(input.date), milestone: "DELIVERED" } });
      for (const m of MILESTONES) {
        await tx.shipmentMilestoneEvent.upsert({ where: { shipmentId_milestone: { shipmentId: sh.id, milestone: m } }, update: {}, create: { shipmentId: sh.id, milestone: m, occurredAt: D(input.date) } });
      }
    }
    data.shipmentStatus = "DELIVERED";
    if (po.customsStatus !== "CLEARED" && sh) data.customsStatus = "CLEARED";
    if (po.productionStatus !== "COMPLETED") data.productionStatus = "COMPLETED";
    await tx.purchaseOrder.update({ where: { id: po.id }, data });
    await logActivity(tx, user, {
      poId: po.id,
      text: `Received ${received.join(", ")} on ${fmtDate(input.date)}. ${all ? "All items received." : "Partial delivery."} Stock updated.`,
      before: { inventoryStatus: po.inventoryStatus },
      after: { inventoryStatus: data.inventoryStatus as string },
    });
    await afterChange(tx, po.id, today, now);
    await refreshSupplierStats(tx, po.supplierId);
    return undefined;
  });
  if (res.ok) {
    revalidatePo(number);
    revalidatePath("/inventory");
  }
  return res;
}

export async function markStocked(poId: string): Promise<ActionResult> {
  let number: string | undefined;
  const res = await runService("receiving:write", poIdSchema, { poId }, async ({ user, tx, today, now }) => {
    const po = await getPo(tx, poId);
    number = po.number;
    if (po.inventoryStatus !== "RECEIVED") throw new UserError("Receive all items first.");
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { inventoryStatus: "STOCKED" } });
    await logActivity(tx, user, { poId: po.id, text: "Goods shelved and stocked.", before: { inventoryStatus: "RECEIVED" }, after: { inventoryStatus: "STOCKED" } });
    await afterChange(tx, po.id, today, now);
    return undefined;
  });
  if (res.ok) revalidatePo(number);
  return res;
}

// ─── Documents ───────────────────────────────────────────────────────────────

export async function uploadDocument(_prev: unknown, fd: FormData): Promise<ActionResult> {
  let number: string | undefined;
  const file = fileFrom(fd);
  const res = await handleStorage(
    runService("document:write", uploadSchema, formToObject(fd), async ({ user, input, tx }) => {
      if (!file) throw new UserError("Choose a file to upload.");
      if (!input.poId && !input.supplierId) throw new UserError("Pick a PO or supplier for this document.");
      const po = input.poId ? await getPo(tx, input.poId) : null;
      number = po?.number;
      const doc = await storeFile(tx, user, file, { poId: po?.id, supplierId: input.supplierId ?? po?.supplierId, type: input.type, title: input.title });
      await logActivity(tx, user, { poId: po?.id, kind: "NOTE", text: `Uploaded ${DOCUMENT_TYPE_LABEL[input.type].toLowerCase()}: ${doc.fileName}.`, entityType: "Document", entityId: doc.id });
      return undefined;
    }),
  );
  if (res.ok) {
    revalidatePo(number);
    revalidatePath("/documents");
  }
  return res;
}

export async function markCustomsDocument(customsDocumentId: string, status: "PENDING" | "RECEIVED" | "MISSING"): Promise<ActionResult> {
  const fd = new FormData();
  fd.set("customsDocumentId", customsDocumentId);
  fd.set("status", status);
  return setCustomsDocument(null, fd);
}

export async function changeCustomsStatus(poId: string, customsStatus: string): Promise<ActionResult> {
  const fd = new FormData();
  fd.set("poId", poId);
  fd.set("customsStatus", customsStatus);
  return setCustomsStatus(null, fd);
}
