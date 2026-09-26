import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "All Purchase Orders" };

export default async function Page() {
  await requirePermission("view:orders");
  return <PagePlaceholder title="All Purchase Orders" subtitle="Every purchase order, filterable by health, stage, payment and shipment." step={4} />;
}
