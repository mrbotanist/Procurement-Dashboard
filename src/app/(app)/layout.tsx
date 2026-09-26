import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/AppShell";
import { NAV, type NavGroup } from "@/components/shell/nav";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { ROLE_LABEL } from "@/lib/status";
import { getShellData } from "@/server/queries/shell";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [{ unresolved, notifications }, jar] = await Promise.all([getShellData(user.id), cookies()]);

  // Only show what this role may open.
  const nav: NavGroup[] = NAV.flatMap((g) => {
    if (g.href) return g.permission && !can(user.role, g.permission) ? [] : [g];
    const items = (g.items ?? []).filter((i) => can(user.role, i.permission));
    return items.length ? [{ ...g, items }] : [];
  });

  return (
    <AppShell
      nav={nav}
      // Reorder alerts are counted once the inventory screen exists (build step 6).
      counts={{ notifications: unresolved, reorder: 0 }}
      user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
      initialCollapsed={jar.get("sidebar")?.value === "collapsed"}
      notifications={notifications}
      canCreatePo={can(user.role, "po:write")}
    >
      {children}
    </AppShell>
  );
}
