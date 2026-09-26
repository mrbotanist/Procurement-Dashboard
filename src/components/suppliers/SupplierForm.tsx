"use client";

import Link from "next/link";
import { Field, ServiceForm, TextArea } from "@/components/ui/Form";

type Action = Parameters<typeof ServiceForm>[0]["action"];

export interface SupplierValues {
  name?: string;
  code?: string;
  city?: string | null;
  country?: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  paymentTerms?: string | null;
  currency?: string;
  incoterm?: string | null;
  incotermPlace?: string | null;
  notes?: string | null;
}

export function SupplierForm({ action, values = {}, cancelHref }: { action: Action; values?: SupplierValues; cancelHref: string }) {
  const v = (k: keyof SupplierValues) => values[k] ?? "";
  return (
    <ServiceForm
      action={action}
      successHref="/suppliers/:id"
      submitLabel="Save supplier"
      cancel={
        <Link href={cancelHref} className="btn btn-secondary">
          Cancel
        </Link>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Supplier name" name="name" defaultValue={v("name")} required />
        <Field label="PO prefix" name="code" defaultValue={v("code")} hint="2–4 letters, e.g. GE → GE-26091" required maxLength={4} />
        <Field label="City" name="city" defaultValue={v("city")} />
        <Field label="Country" name="country" defaultValue={v("country")} required />
        <Field label="Contact person" name="contactName" defaultValue={v("contactName")} />
        <Field label="Email" name="email" type="email" defaultValue={v("email")} />
        <Field label="Phone" name="phone" defaultValue={v("phone")} />
        <Field label="Website" name="website" defaultValue={v("website")} />
        <Field label="Payment terms" name="paymentTerms" defaultValue={v("paymentTerms")} hint='e.g. "50% deposit, 50% before shipment"' />
        <Field label="Currency" name="currency" defaultValue={v("currency") || "USD"} maxLength={3} />
        <Field label="Incoterm" name="incoterm" defaultValue={v("incoterm")} hint="EXW, FCA, CIP…" />
        <Field label="Incoterm place" name="incotermPlace" defaultValue={v("incotermPlace")} />
      </div>
      <TextArea label="Notes" name="notes" defaultValue={v("notes")} />
    </ServiceForm>
  );
}
