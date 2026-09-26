import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Purchase Order" };

export default async function Page({ params }: PageProps<"/orders/[number]">) {
  const { number } = await params;
  await requirePermission("view:orders");
  return <PagePlaceholder title={`PO #${number}`} subtitle="Timeline, statuses, payments, shipment, customs, activity and documents." step={4} />;
}
