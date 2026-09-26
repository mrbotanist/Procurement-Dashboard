import type { Metadata } from "next";
import { EditUserDialog, NewUserDialog } from "@/components/settings/UserDialogs";
import { Card } from "@/components/ui/Card";
import { Page, PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { toIsoDate } from "@/lib/dates";
import { fmtDate } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/status";

export const metadata: Metadata = { title: "Settings" };

const ROLE_HELP: Record<string, string> = {
  ADMIN: "Everything, including users and budgets",
  PROCUREMENT_MANAGER: "POs, suppliers, products, payments, shipments, documents, notes",
  FINANCE: "View all; record payments",
  WAREHOUSE: "View POs and shipments; receive goods; stock counts",
  MANAGEMENT: "Read-only, including analytics",
};

export default async function SettingsPage() {
  await requirePermission("user:manage");
  const [users, recent] = await Promise.all([
    db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    db.activityLog.findMany({ where: { poId: null }, orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  return (
    <Page>
      <PageHeader title="Settings" subtitle="Users, roles and the audit trail of admin changes." actions={<NewUserDialog />} />
      <Card title="Users" aside={`${users.filter((u) => u.active).length} active`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[12.5px] text-secondary">
                <th className="py-2.5 font-normal">Name</th>
                <th className="font-normal">Email</th>
                <th className="font-normal">Role</th>
                <th className="font-normal">Status</th>
                <th className="font-normal">Since</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-neutral-200">
                  <td className="py-2.5 font-semibold">{u.name}</td>
                  <td>{u.email}</td>
                  <td title={ROLE_HELP[u.role]}>{ROLE_LABEL[u.role]}</td>
                  <td>
                    <Pill label={u.active ? "Active" : "Inactive"} tone={u.active ? "green" : "gray"} />
                  </td>
                  <td>{fmtDate(toIsoDate(u.createdAt))}</td>
                  <td className="text-right">
                    <EditUserDialog user={{ id: u.id, name: u.name, role: u.role, active: u.active }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-2 text-[13px] text-secondary sm:grid-cols-2">
          {Object.entries(ROLE_HELP).map(([r, h]) => (
            <span key={r}>
              <b className="text-ink">{ROLE_LABEL[r as keyof typeof ROLE_LABEL]}</b> — {h}
            </span>
          ))}
        </div>
      </Card>
      <Card title="Recent admin activity" subtitle="Changes to suppliers, products, budgets, users and notifications. PO changes are on each PO.">
        {recent.map((a) => (
          <div key={a.id} className="flex gap-3 border-b border-neutral-200 py-2 text-sm last:border-b-0">
            <span className="w-16 flex-none text-secondary">{fmtDate(toIsoDate(a.createdAt))}</span>
            <span className="w-36 flex-none truncate text-secondary">{a.actorLabel}</span>
            <span>{a.text}</span>
          </div>
        ))}
      </Card>
    </Page>
  );
}
