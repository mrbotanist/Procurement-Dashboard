import "server-only";
import { db } from "@/lib/db";
import type { IsoDate } from "@/lib/dates";
import { budgetSummary, type BudgetSummary } from "@/lib/domain/budget";
import { compareByHealth } from "@/lib/domain/orders";
import { isOpenPo, poSummaries, yearRange, type PoSummary } from "./pos";

export interface BrandBudgetRow extends BudgetSummary {
  brandId: string;
  brand: string;
}

/** Purchased / committed per brand for a year, from that year's POs. */
export async function brandSpend(year: number, today: IsoDate) {
  const pos = await poSummaries({ orderDate: yearRange(year), poStatus: { notIn: ["DRAFT", "CANCELLED"] } }, today);
  const byBrand = new Map<string, { purchased: number; committed: number }>();
  for (const p of pos) {
    const b = byBrand.get(p.brand.id) ?? { purchased: 0, committed: 0 };
    if (p.budgetBucket === "purchased") b.purchased += p.total;
    if (p.budgetBucket === "committed") b.committed += p.total;
    byBrand.set(p.brand.id, b);
  }
  return { pos, byBrand };
}

export async function getBudgets(year: number, today: IsoDate) {
  const [budgets, { pos, byBrand }, brands] = await Promise.all([
    db.brandBudget.findMany({ where: { year }, include: { brand: true } }),
    brandSpend(year, today),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const rows: BrandBudgetRow[] = budgets
    .map((b) => {
      const s = byBrand.get(b.brandId) ?? { purchased: 0, committed: 0 };
      return { brandId: b.brandId, brand: b.brand.name, ...budgetSummary({ budget: Number(b.amountUsd), ...s }) };
    })
    .sort((a, b) => b.budget - a.budget);
  return { rows, pos, brands };
}

export function brandTrend(pos: PoSummary[], brandId: string, year: number, throughMonth: number) {
  return Array.from({ length: throughMonth }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    return { month: i + 1, value: pos.filter((p) => p.brand.id === brandId && p.orderDate.startsWith(key)).reduce((s, p) => s + p.total, 0) };
  });
}

export const openBrandPos = (pos: PoSummary[], brandId: string) => pos.filter((p) => p.brand.id === brandId && isOpenPo(p)).sort(compareByHealth);
