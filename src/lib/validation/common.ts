import { z } from "zod";

/** Empty string → undefined, so optional form fields validate cleanly. */
export const optionalText = (max = 500) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v), z.string().max(max).optional());

export const requiredText = (max = 200) => z.string().trim().min(1, "Required").max(max);

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");
export const optionalDate = z.preprocess((v) => (v === "" || v == null ? undefined : v), isoDate.optional());

export const money = z.coerce.number({ error: "Enter an amount" }).min(0, "Can't be negative").max(1e9);
export const positiveMoney = z.coerce.number({ error: "Enter an amount" }).positive("Must be more than 0").max(1e9);
export const percent = z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().min(0).max(100));
export const intQty = z.coerce.number({ error: "Enter a number" }).int("Whole numbers only").min(0).max(10_000_000);
export const id = z.string().min(1).max(64);
