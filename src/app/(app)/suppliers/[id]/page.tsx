import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Supplier" };

export default async function Page() {
  await requirePermission("view:suppliers");
  return <PagePlaceholder title="Supplier" subtitle="Purchase history, current orders, information and documents." step={3} />;
}
