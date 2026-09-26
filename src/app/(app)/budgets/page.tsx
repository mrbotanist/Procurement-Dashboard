import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Brand Budgets" };

export default async function Page() {
  await requirePermission("view:budgets");
  return <PagePlaceholder title="Brand Budgets" subtitle="Budget, purchased, committed and available by brand." step={3} />;
}
