import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SupplierForm } from "@/components/suppliers/SupplierForm";
import { Page, PageHeader } from "@/components/ui/PageHeader";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { saveSupplier } from "@/server/services/master";

export const metadata: Metadata = { title: "Edit supplier" };

export default async function EditSupplierPage({ params }: PageProps<"/suppliers/[id]/edit">) {
  await requirePermission("supplier:write");
  const { id } = await params;
  const s = await db.supplier.findUnique({ where: { id } });
  if (!s) notFound();
  return (
    <Page className="max-w-[860px]!">
      <PageHeader title={`Edit ${s.name}`} back={{ href: `/suppliers/${id}`, label: s.name }} />
      <div className="card">
        <SupplierForm action={saveSupplier.bind(null, id)} values={s} cancelHref={`/suppliers/${id}`} />
      </div>
    </Page>
  );
}
