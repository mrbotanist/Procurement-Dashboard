"use client";

import { useState } from "react";
import { Header } from "./Header";
import type { HeaderNotification } from "./NotificationsPopover";
import type { Counter, NavGroup } from "./nav";
import { Sidebar, type SidebarUser } from "./Sidebar";

interface Props {
  children: React.ReactNode;
  nav: NavGroup[];
  counts: Record<Counter, number>;
  user: SidebarUser;
  initialCollapsed: boolean;
  notifications: HeaderNotification[];
  canCreatePo: boolean;
}

export function AppShell({ children, nav, counts, user, initialCollapsed, notifications, canCreatePo }: Props) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [drawer, setDrawer] = useState(false);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `sidebar=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar nav={nav} counts={counts} user={user} collapsed={collapsed} />
      </div>

      {/* Drawer below 1024px */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-ink/30" onClick={() => setDrawer(false)} />
          <div className="relative h-full w-fit shadow-pop">
            <Sidebar nav={nav} counts={counts} user={user} collapsed={false} onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          notifications={notifications}
          unresolved={counts.notifications}
          canCreatePo={canCreatePo}
          onToggleSidebar={toggle}
          onOpenDrawer={() => setDrawer(true)}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
