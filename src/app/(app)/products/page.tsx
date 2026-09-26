import type { Metadata } from "next";
import { ProductDialog, StockDialog } from "@/components/products/ProductDialog";
import { Page, PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const user = await requirePermission("view:inventory");
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const [products, brands] = await Promise.all([
    db.product.findMany({
      where: query ? { OR: [{ sku: { contains: query, mode: "insensitive" } }, { name: { contains: query, mode: "insensitive" } }, { brand: { name: { contains: query, mode: "insensitive" } } }] } : {},
      include: { brand: true },
      orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
    }),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  const categories = [...new Set((await db.product.findMany({ select: { category: true }, distinct: ["category"] })).map((p) => p.category))].sort();
  const canEdit = can(user.role, "product:write");
  const canCount = can(user.role, "stock:write");

  return (
    <Page>
      <PageHeader
        title="Products"
        subtitle={`${products.length} products in the catalogue`}
        actions={canEdit && <ProductDialog brands={brands.map((b) => b.name)} categories={categories} />}
      />
      <form className="flex max-w-[420px] gap-2">
        <input name="q" defaultValue={query} placeholder="Search SKU, product or brand" className="input" aria-label="Search products" />
        <button className="btn btn-secondary">Search</button>
      </form>
      <section className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[12.5px] text-secondary">
              <th className="py-2.5 font-normal">SKU</th>
              <th className="font-normal">Product</th>
              <th className="font-normal">Brand</th>
              <th className="font-normal">Category</th>
              <th className="text-right font-normal">Stock</th>
              <th className="text-right font-normal">Sold / day</th>
              <th className="text-right font-normal">Cover</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const rate = Number(p.dailySalesRate);
              const values = { id: p.id, sku: p.sku, name: p.name, brand: p.brand.name, category: p.category, stockQty: p.stockQty, dailySalesRate: rate };
              return (
                <tr key={p.id} className="border-b border-neutral-200 hover:bg-surface">
                  <td className="py-2.5 text-[13px]">{p.sku}</td>
                  <td className="font-semibold">{p.name}</td>
                  <td>{p.brand.name}</td>
                  <td>{p.category}</td>
                  <td className="text-right">{p.stockQty.toLocaleString()}</td>
                  <td className="text-right">{rate}</td>
                  <td className="text-right">{rate > 0 ? `${Math.floor(p.stockQty / rate)} days` : "—"}</td>
                  <td className="text-right whitespace-nowrap">
                    {canCount && !canEdit && <StockDialog product={values} />}
                    {canEdit && <ProductDialog product={values} brands={brands.map((b) => b.name)} categories={categories} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {products.length === 0 && <p className="py-5 text-sm text-secondary">No products match “{query}”.</p>}
      </section>
    </Page>
  );
}
