"use client";

import { Dialog } from "@/components/ui/Dialog";
import { Field, SelectField, ServiceForm } from "@/components/ui/Form";
import { saveBudget } from "@/server/services/master";

export function BudgetDialog({ brands, year, brand, amount, label }: { brands: string[]; year: number; brand?: string; amount?: number; label: string }) {
  return (
    <Dialog
      title={brand ? `${brand} budget ${year}` : `Add brand budget ${year}`}
      trigger={(open) => (
        <button type="button" onClick={open} className={brand ? "btn btn-secondary" : "btn btn-primary"}>
          {label}
        </button>
      )}
    >
      {(close) => (
        <ServiceForm action={saveBudget} onDone={close} submitLabel="Save budget">
          <input type="hidden" name="year" value={year} />
          {brand ? (
            <input type="hidden" name="brand" value={brand} />
          ) : (
            <SelectField label="Brand" name="brand" options={brands.map((b) => ({ value: b, label: b }))} />
          )}
          <Field label="Annual budget (USD)" name="amountUsd" type="number" min={0} step="100" defaultValue={amount ?? ""} required />
        </ServiceForm>
      )}
    </Dialog>
  );
}
