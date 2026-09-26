import type { Metadata } from "next";
import { PasswordForm } from "./PasswordForm";
import { Page, PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/status";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <Page className="max-w-[640px]!">
      <PageHeader title="My account" subtitle={`${user.name} · ${user.email} · ${ROLE_LABEL[user.role]}`} />
      <div className="card">
        <h2 className="mb-3 text-[17px]">Change password</h2>
        <PasswordForm />
      </div>
    </Page>
  );
}
