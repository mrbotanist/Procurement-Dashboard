import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Action Center" };

export default async function Page() {
  await requirePermission("view:actions");
  return <PagePlaceholder title="Action Center" subtitle="Delays, overdue payments, pending confirmations and updates." step={7} />;
}
