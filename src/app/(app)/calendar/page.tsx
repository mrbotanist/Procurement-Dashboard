import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Purchase Calendar" };

export default async function Page() {
  await requirePermission("view:calendar");
  return <PagePlaceholder title="Purchase Calendar" subtitle="Payments, production, shipments, customs and arrivals by date." step={6} />;
}
