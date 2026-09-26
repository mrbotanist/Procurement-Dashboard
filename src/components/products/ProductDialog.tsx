"use client";

import { Dialog } from "@/components/ui/Dialog";
import { Field, ServiceForm } from "@/components/ui/Form";
import { saveProduct, updateStock } from "@/server/services/master";

export interface ProductValues {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  stockQty: number;
  dailySalesRate: number;
}

export function ProductDialog({ product, brands, categories }: { product?: ProductValues; brands: string[]; categories: string[] }) {
  return (
    <Dialog
      title={product ? `Edit ${product.sku}` : "New product"}
      width={560}
      trigger={(open) => (
        <button type="button" onClick={open} className={product ? "btn btn-ghost px-2! py-1! text-[13px]" : "btn btn-primary"}>
          {product ? "Edit" : "+ New product"}
        </button>
      )}
    >
      {(close) => (
        <ServiceForm action={saveProduct.bind(null, product?.id ?? null)} onDone={close} submitLabel="Save product">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SKU" name="sku" defaultValue={product?.sku} required />
            <Field label="Product name" name="name" defaultValue={product?.name} required />
            <Field label="Brand" name="brand" defaultValue={product?.brand} list="brand-options" required hint="Pick one or type a new brand" />
            <Field label="Category" name="category" defaultValue={product?.category} list="category-options" required />
            <Field label="Stock on hand" name="stockQty" type="number" min={0} step={1} defaultValue={product?.stockQty ?? 0} />
            <Field label="Units sold per day" name="dailySalesRate" type="number" min={0} step="0.1" defaultValue={product?.dailySalesRate ?? 0} hint="Used for stockout risk" />
          </div>
          <datalist id="brand-options">{brands.map((b) => <option key={b} value={b} />)}</datalist>
          <datalist id="category-options">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </ServiceForm>
      )}
    </Dialog>
  );
}

export function StockDialog({ product }: { product: ProductValues }) {
  return (
    <Dialog
      title={`Stock count · ${product.sku}`}
      width={400}
      trigger={(open) => (
        <button type="button" onClick={open} className="btn btn-ghost px-2! py-1! text-[13px]">
          Count
        </button>
      )}
    >
      {(close) => (
        <ServiceForm action={updateStock} onDone={close} submitLabel="Save count">
          <input type="hidden" name="productId" value={product.id} />
          <Field label="Units on hand" name="stockQty" type="number" min={0} step={1} defaultValue={product.stockQty} autoFocus />
        </ServiceForm>
      )}
    </Dialog>
  );
}
