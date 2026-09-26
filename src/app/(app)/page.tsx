import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Procurement Dashboard" };

export default async function Page() {
  await requirePermission("view:dashboard");
  return <PagePlaceholder title="Procurement Dashboard" subtitle="Overview of purchasing activity, payments, shipments and incoming inventory." step={6} />;
}
