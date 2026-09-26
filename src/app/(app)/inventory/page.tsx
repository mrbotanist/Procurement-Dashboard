import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Incoming Inventory" };

export default async function Page() {
  await requirePermission("view:inventory");
  return <PagePlaceholder title="Incoming Inventory" subtitle="Current stock, incoming quantities and stockout risk." step={6} />;
}
