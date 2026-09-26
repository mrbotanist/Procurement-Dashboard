import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Analytics" };

export default async function Page() {
  await requirePermission("view:analytics");
  return <PagePlaceholder title="Analytics" subtitle="Spend by month, supplier, brand, category and country." step={6} />;
}
