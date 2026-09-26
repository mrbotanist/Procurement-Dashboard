import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Documents" };

export default async function Page() {
  await requirePermission("view:documents");
  return <PagePlaceholder title="Documents" subtitle="Quotations, invoices, receipts, shipping and customs files." step={5} />;
}
