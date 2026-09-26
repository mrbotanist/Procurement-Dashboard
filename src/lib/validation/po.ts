import { z } from "zod";
import { id, intQty, isoDate, optionalDate, optionalText, percent, positiveMoney, requiredText } from "./common";

export const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"] as const;
export const CARRIERS = ["DHL Express", "FedEx", "Aramex", "UPS", "Emirates SkyCargo", "Sea freight"] as const;
export const PAYMENT_METHODS = ["Bank transfer (TT)", "Card", "PayPal Business", "Cash", "Other"] as const;

export const poLineSchema = z.object({
  productId: z.string().optional().nullable(),
  sku: z.string().trim().toUpperCase().min(2, "SKU required").max(40),
  name: requiredText(160),
  qty: z.coerce.number().int("Whole units").positive("Qty must be at least 1").max(10_000_000),
  unitPrice: z.coerce.number().min(0).max(10_000_000),
  discountPct: percent,
  taxPct: percent,
});

export const createPoSchema = z.object({
  supplierId: id,
  brandId: id,
  currency: z.string().regex(/^[A-Z]{3}$/),
  paymentTerms: optionalText(200),
  incoterm: z.enum(INCOTERMS).optional(),
  expectedProductionDate: optionalDate,
  expectedShipDate: optionalDate,
  carrier: optionalText(80),
  notes: optionalText(2000),
  lines: z.array(poLineSchema).min(1, "Add at least one product").max(200),
  send: z.boolean(),
});
export type CreatePoInput = z.infer<typeof createPoSchema>;

export const poIdSchema = z.object({ poId: id });

export const editPoSchema = z.object({
  poId: id,
  paymentTerms: optionalText(200),
  incoterm: z.preprocess((v) => (v === "" ? undefined : v), z.enum(INCOTERMS).optional()),
  plannedCarrier: optionalText(80),
  expectedProductionDate: optionalDate,
  expectedShipDate: optionalDate,
  eta: optionalDate,
  notes: optionalText(2000),
});

export const cancelSchema = z.object({ poId: id, reason: requiredText(500) });

export const noteSchema = z.object({
  poId: id,
  text: requiredText(2000),
  fromSupplier: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export const productionSchema = z.object({
  poId: id,
  productionStatus: z.enum(["NOT_STARTED", "IN_PRODUCTION", "READY", "DELAYED", "COMPLETED"]),
  productionProgressPct: z.coerce.number().int().min(0).max(100),
  expectedProductionDate: optionalDate,
  note: optionalText(2000),
  fromSupplier: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export const recordPaymentSchema = z.object({
  poId: id,
  paymentId: z.preprocess((v) => (v === "" || v === "new" ? undefined : v), id.optional()),
  amount: positiveMoney,
  paidDate: isoDate,
  method: z.enum(PAYMENT_METHODS),
  bankReference: optionalText(120),
  notes: optionalText(1000),
});

export const schedulePaymentSchema = z.object({
  poId: id,
  type: z.enum(["DEPOSIT", "BALANCE", "OTHER"]),
  amount: positiveMoney,
  dueDate: isoDate,
});

export const shipmentSchema = z.object({
  poId: id,
  shipmentId: z.preprocess((v) => (v === "" ? undefined : v), id.optional()),
  carrier: requiredText(80),
  trackingNumber: optionalText(80),
  trackingUrl: z.preprocess((v) => (v === "" ? undefined : v), z.url("Enter a full link starting with https://").optional()),
  origin: optionalText(120),
  destination: optionalText(120),
  shipDate: optionalDate,
  eta: optionalDate,
  shippingCost: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().min(0).max(1e8).optional()),
});

export const MILESTONES = ["SUPPLIER", "PICKED_UP", "EXPORT_CUSTOMS", "IN_TRANSIT", "IMPORT_CUSTOMS", "DELIVERED"] as const;
export const milestoneSchema = z.object({ shipmentId: id, milestone: z.enum(MILESTONES), date: isoDate });

export const customsDocSchema = z.object({ customsDocumentId: id, status: z.enum(["PENDING", "RECEIVED", "MISSING"]) });
export const customsStatusSchema = z.object({ poId: id, customsStatus: z.enum(["NOT_STARTED", "DOCUMENTS_REQUIRED", "IN_CLEARANCE", "CLEARED", "ON_HOLD"]) });
export const customsCostSchema = z.object({
  shipmentId: id,
  duty: z.coerce.number().min(0).max(1e8),
  importVat: z.coerce.number().min(0).max(1e8),
  clearanceCharges: z.coerce.number().min(0).max(1e8),
});

export const receiveSchema = z.object({
  poId: id,
  date: isoDate,
  lines: z.array(z.object({ itemId: id, qty: intQty })).min(1),
});

export const DOCUMENT_TYPES = [
  "QUOTATION", "PROFORMA_INVOICE", "PURCHASE_ORDER", "COMMERCIAL_INVOICE", "PACKING_LIST", "PAYMENT_RECEIPT",
  "CERTIFICATE_OF_ORIGIN", "AIR_WAYBILL", "BILL_OF_LADING", "CUSTOMS", "CORRESPONDENCE", "OTHER",
] as const;
export const uploadSchema = z.object({
  poId: z.preprocess((v) => (v === "" ? undefined : v), id.optional()),
  supplierId: z.preprocess((v) => (v === "" ? undefined : v), id.optional()),
  type: z.enum(DOCUMENT_TYPES),
  title: optionalText(160),
});
