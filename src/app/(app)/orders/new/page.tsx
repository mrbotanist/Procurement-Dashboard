import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create Purchase Order" };

export default async function Page() {
  await requirePermission("po:write");
  return <PagePlaceholder title="Create Purchase Order" subtitle="Five steps. Nothing is sent until you confirm on Review." step={4} />;
}
