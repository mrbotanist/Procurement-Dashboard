import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Suppliers" };

export default async function Page() {
  await requirePermission("view:suppliers");
  return <PagePlaceholder title="Suppliers" subtitle="Open orders, outstanding payments and performance by supplier." step={3} />;
}
