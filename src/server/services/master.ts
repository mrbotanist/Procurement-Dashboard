"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { budgetSchema, productSchema, stockSchema, supplierSchema } from "@/lib/validation/master";
import { diff, formToObject, logActivity, runService, UserError, type ActionResult } from "./base";

// ─── Suppliers ───────────────────────────────────────────────────────────────

export async function saveSupplier(supplierId: string | null, _prev: unknown, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runService("supplier:write", supplierSchema, formToObject(fd), async ({ user, input, tx }) => {
    if (supplierId) {
      const before = await tx.supplier.findUniqueOrThrow({ where: { id: supplierId } });
      const d = diff(before as unknown as Record<string, unknown>, input);
      await tx.supplier.update({ where: { id: supplierId }, data: input });
      if (d.changed.length) {
        await logActivity(tx, user, { text: `Updated supplier ${input.name}: ${d.changed.join(", ")}.`, entityType: "Supplier", entityId: supplierId, before: d.before as never, after: d.after as never });
      }
      return { id: supplierId };
    }
    const s = await tx.supplier.create({ data: input });
    await logActivity(tx, user, { text: `Created supplier ${s.name}.`, entityType: "Supplier", entityId: s.id, after: input as never });
    return { id: s.id };
  });
  if (res.ok) {
    revalidatePath("/suppliers", "layout");
    revalidatePath("/orders/new");
  }
  return res;
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function saveProduct(productId: string | null, _prev: unknown, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runService("product:write", productSchema, formToObject(fd), async ({ user, input, tx }) => {
    const brand = await tx.brand.upsert({ where: { name: input.brand }, update: {}, create: { name: input.brand } });
    const data = { sku: input.sku, name: input.name, brandId: brand.id, category: input.category, stockQty: input.stockQty, dailySalesRate: input.dailySalesRate };
    if (productId) {
      const before = await tx.product.findUniqueOrThrow({ where: { id: productId } });
      const d = diff(before as unknown as Record<string, unknown>, data);
      await tx.product.update({ where: { id: productId }, data });
      if (d.changed.length) {
        await logActivity(tx, user, { text: `Updated product ${input.sku}: ${d.changed.join(", ")}.`, entityType: "Product", entityId: productId, before: d.before as never, after: d.after as never });
      }
      return { id: productId };
    }
    const p = await tx.product.create({ data });
    await logActivity(tx, user, { text: `Created product ${p.sku}.`, entityType: "Product", entityId: p.id, after: data as never });
    return { id: p.id };
  });
  if (res.ok) {
    revalidatePath("/products");
    revalidatePath("/inventory");
  }
  return res;
}

/** Warehouse stock count correction. */
export async function updateStock(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const res = await runService("stock:write", stockSchema, formToObject(fd), async ({ user, input, tx }) => {
    const before = await tx.product.findUniqueOrThrow({ where: { id: input.productId } });
    if (before.stockQty === input.stockQty) return undefined;
    await tx.product.update({ where: { id: input.productId }, data: { stockQty: input.stockQty } });
    await logActivity(tx, user, {
      text: `Stock for ${before.sku} corrected from ${before.stockQty} to ${input.stockQty}.`,
      entityType: "Product", entityId: before.id, before: { stockQty: before.stockQty }, after: { stockQty: input.stockQty },
    });
    return undefined;
  });
  if (res.ok) {
    revalidatePath("/products");
    revalidatePath("/inventory");
  }
  return res;
}

// ─── Brand budgets ───────────────────────────────────────────────────────────

export async function saveBudget(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const res = await runService("budget:write", budgetSchema, formToObject(fd), async ({ user, input, tx }) => {
    const brand = await tx.brand.findUnique({ where: { name: input.brand } });
    if (!brand) throw new UserError(`No brand called "${input.brand}".`);
    const before = await tx.brandBudget.findUnique({ where: { brandId_year: { brandId: brand.id, year: input.year } } });
    await tx.brandBudget.upsert({
      where: { brandId_year: { brandId: brand.id, year: input.year } },
      update: { amountUsd: input.amountUsd },
      create: { brandId: brand.id, year: input.year, amountUsd: input.amountUsd },
    });
    await logActivity(tx, user, {
      text: `${before ? "Changed" : "Set"} ${brand.name} ${input.year} budget ${before ? `from $${before.amountUsd} ` : ""}to $${input.amountUsd}.`,
      entityType: "BrandBudget", entityId: brand.id, before: before ? { amountUsd: String(before.amountUsd) } : undefined, after: { amountUsd: String(input.amountUsd) },
    });
    return undefined;
  });
  if (res.ok) revalidatePath("/budgets");
  return res;
}

export async function deleteBudget(brandId: string, year: number): Promise<ActionResult> {
  const res = await runService("budget:write", z.object({ brandId: z.string(), year: z.number().int() }), { brandId, year }, async ({ user, input, tx }) => {
    const b = await tx.brandBudget.delete({ where: { brandId_year: input }, include: { brand: true } });
    await logActivity(tx, user, { text: `Removed ${b.brand.name} ${input.year} budget ($${b.amountUsd}).`, entityType: "BrandBudget", entityId: brandId, before: { amountUsd: String(b.amountUsd) } });
    return undefined;
  });
  if (res.ok) revalidatePath("/budgets");
  return res;
}
