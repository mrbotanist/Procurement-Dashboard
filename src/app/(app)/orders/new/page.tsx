import type { Metadata } from "next";
import { CreatePoWizard, type WizardData } from "@/components/create-po/CreatePoWizard";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { todayIso } from "@/lib/dates";
import { budgetSummary } from "@/lib/domain/budget";
import { brandSpend } from "@/server/queries/budgets";

export const metadata: Metadata = { title: "Create Purchase Order" };

export default async function NewPoPage({ searchParams }: PageProps<"/orders/new">) {
  await requirePermission("po:write");
  const { supplier } = await searchParams;
  const today = todayIso();
  const year = Number(today.slice(0, 4));
  const [suppliers, products, lastLines, budgets, spend, brands] = await Promise.all([
    db.supplier.findMany({ orderBy: { name: "asc" } }),
    db.product.findMany({ include: { brand: true }, orderBy: { name: "asc" } }),
    db.pOItem.findMany({
      orderBy: { po: { orderDate: "desc" } },
      select: { productId: true, unitPrice: true, po: { select: { supplierId: true, brandId: true } } },
    }),
    db.brandBudget.findMany({ where: { year } }),
    brandSpend(year, today),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  // Last price per (supplier, product) and which brands each supplier sells.
  const lastPrice = new Map<string, number>();
  const supplierBrands = new Map<string, Set<string>>();
  for (const l of lastLines) {
    const key = `${l.po.supplierId}:${l.productId}`;
    if (!lastPrice.has(key)) lastPrice.set(key, Number(l.unitPrice));
    if (!supplierBrands.has(l.po.supplierId)) supplierBrands.set(l.po.supplierId, new Set());
    supplierBrands.get(l.po.supplierId)!.add(l.po.brandId);
  }

  const data: WizardData = {
    today,
    suppliers: suppliers.map((s) => {
      const brandIds = supplierBrands.get(s.id) ?? new Set(brands.filter((b) => b.name === s.name).map((b) => b.id));
      return {
        id: s.id,
        name: s.name,
        country: s.country,
        currency: s.currency,
        leadTimeDays: s.leadTimeDays,
        onTimeRate: s.onTimeRate == null ? null : Number(s.onTimeRate),
        paymentTerms: s.paymentTerms ?? "",
        incoterm: s.incoterm ?? "EXW",
        brandIds: [...brandIds],
        catalog: products
          .filter((p) => brandIds.has(p.brandId))
          .map((p) => ({ productId: p.id, sku: p.sku, name: p.name, brandId: p.brandId, unitPrice: lastPrice.get(`${s.id}:${p.id}`) ?? 0 })),
      };
    }),
    allProducts: products.map((p) => ({ productId: p.id, sku: p.sku, name: p.name, brandId: p.brandId, unitPrice: 0 })),
    brands: brands.map((b) => {
      const bud = budgets.find((x) => x.brandId === b.id);
      const s = spend.byBrand.get(b.id) ?? { purchased: 0, committed: 0 };
      return { id: b.id, name: b.name, available: bud ? budgetSummary({ budget: Number(bud.amountUsd), ...s }).available : null };
    }),
    initialSupplierId: typeof supplier === "string" ? supplier : null,
  };
  return <CreatePoWizard data={data} />;
}
