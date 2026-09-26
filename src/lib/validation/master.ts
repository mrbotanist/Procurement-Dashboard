import { z } from "zod";
import { money, optionalText, requiredText } from "./common";

export const supplierSchema = z.object({
  name: requiredText(120),
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{2,4}$/, "2–4 letters, used as the PO number prefix"),
  city: optionalText(80),
  country: requiredText(80),
  contactName: optionalText(120),
  email: z.preprocess((v) => (v === "" ? undefined : v), z.email("Enter a valid email").optional()),
  phone: optionalText(40),
  website: optionalText(200),
  paymentTerms: optionalText(200),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "3-letter code, e.g. USD").default("USD"),
  incoterm: optionalText(10),
  incotermPlace: optionalText(80),
  notes: optionalText(2000),
});
export type SupplierInput = z.infer<typeof supplierSchema>;

export const productSchema = z.object({
  sku: z.string().trim().toUpperCase().min(2).max(40).regex(/^[A-Z0-9][A-Z0-9._-]*$/, "Letters, numbers, dot, dash or underscore"),
  name: requiredText(160),
  brand: requiredText(80),
  category: requiredText(80),
  stockQty: z.coerce.number().int("Whole numbers only").min(0).max(10_000_000),
  dailySalesRate: z.coerce.number().min(0).max(100_000),
});
export type ProductInput = z.infer<typeof productSchema>;

export const stockSchema = z.object({ productId: z.string().min(1), stockQty: z.coerce.number().int().min(0).max(10_000_000) });

export const budgetSchema = z.object({
  brand: requiredText(80),
  year: z.coerce.number().int().min(2000).max(2100),
  amountUsd: money,
});
