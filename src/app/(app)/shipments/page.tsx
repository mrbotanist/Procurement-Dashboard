import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Shipments & Customs" };

export default async function Page() {
  await requirePermission("view:shipments");
  return <PagePlaceholder title="Shipments & Customs" subtitle="Shipment milestones, tracking, customs documents and import costs." step={5} />;
}
