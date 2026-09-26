import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

export default async function Page() {
  await requirePermission("settings:manage");
  return <PagePlaceholder title="Settings" subtitle="Users, roles, currencies and notification rules." step={8} />;
}
