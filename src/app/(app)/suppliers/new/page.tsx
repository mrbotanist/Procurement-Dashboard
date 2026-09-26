import type { Metadata } from "next";
import { SupplierForm } from "@/components/suppliers/SupplierForm";
import { Page, PageHeader } from "@/components/ui/PageHeader";
import { requirePermission } from "@/lib/auth/session";
import { saveSupplier } from "@/server/services/master";

export const metadata: Metadata = { title: "New supplier" };

export default async function NewSupplierPage() {
  await requirePermission("supplier:write");
  return (
    <Page className="max-w-[860px]!">
      <PageHeader title="New supplier" back={{ href: "/suppliers", label: "All suppliers" }} />
      <div className="card">
        <SupplierForm action={saveSupplier.bind(null, null)} cancelHref="/suppliers" />
      </div>
    </Page>
  );
}
