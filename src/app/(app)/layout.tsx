import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/AppShell";
import { NAV, type NavGroup } from "@/components/shell/nav";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { ROLE_LABEL } from "@/lib/status";
import { todayIso } from "@/lib/dates";
import { inventoryRows } from "@/server/queries/insights";
import { getShellData } from "@/server/queries/shell";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [{ unresolved, notifications }, jar, stock] = await Promise.all([
    getShellData(user.id),
    cookies(),
    can(user.role, "view:inventory") ? inventoryRows(todayIso()) : Promise.resolve([]),
  ]);

  // Only show what this role may open.
  const nav: NavGroup[] = NAV.flatMap((g) => {
    if (g.href) return g.permission && !can(user.role, g.permission) ? [] : [g];
    const items = (g.items ?? []).filter((i) => can(user.role, i.permission));
    return items.length ? [{ ...g, items }] : [];
  });

  return (
    <AppShell
      nav={nav}
      counts={{ notifications: unresolved, reorder: stock.filter((r) => r.level === "risk").length }}
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      initialCollapsed={jar.get("sidebar")?.value === "collapsed"}
      notifications={notifications}
      canCreatePo={can(user.role, "po:write")}
    >
      {children}
    </AppShell>
  );
}
