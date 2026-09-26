"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/ui/BrandMark";
import { initials } from "@/lib/format";
import { activeHref, type Counter, type NavGroup } from "./nav";
import { signOutAction } from "./actions";

export interface SidebarUser {
  name: string;
  roleLabel: string;
}

interface Props {
  nav: NavGroup[];
  counts: Record<Counter, number>;
  user: SidebarUser;
  collapsed: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ nav, counts, user, collapsed, onNavigate }: Props) {
  const active = activeHref(usePathname(), useSearchParams().get("tab"));

  return (
    <aside
      className="flex h-full flex-none flex-col overflow-hidden border-r border-line bg-white transition-[width] duration-150 ease-out"
      style={{ width: collapsed ? 72 : 252 }}
    >
      <div className="flex h-16 flex-none items-center gap-2.5 border-b border-line px-[18px]">
        <BrandMark />
        {!collapsed && <span className="text-[15px] font-semibold whitespace-nowrap">FPV Procurement Hub</span>}
      </div>

      {collapsed ? (
        <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-3">
          {nav.map((g) => {
            const href = g.href ?? g.items![0].href;
            const on = g.href ? active === g.href : g.items!.some((i) => i.href === active);
            return (
              <Link
                key={g.label}
                href={href}
                title={g.label}
                onClick={onNavigate}
                className={`flex h-9 w-10 items-center justify-center rounded-lg text-[13px] font-semibold hover:bg-neutral-100 ${on ? "bg-neutral-200" : ""}`}
              >
                {g.label[0]}
              </Link>
            );
          })}
        </nav>
      ) : (
        <nav className="flex flex-1 flex-col overflow-y-auto pt-3 pb-4">
          {nav.map((g) => (
            <div key={g.label} className="flex flex-col py-1">
              {g.href ? (
                <Link
                  href={g.href}
                  onClick={onNavigate}
                  className={`mx-2.5 flex h-[34px] items-center rounded-lg px-2.5 text-sm hover:bg-neutral-100 ${active === g.href ? "bg-neutral-200 font-semibold" : ""}`}
                >
                  {g.label}
                </Link>
              ) : (
                <>
                  <div className="px-[18px] py-1 text-[12.5px] text-neutral-600">{g.label}</div>
                  {g.items!.map((it) => {
                    const count = it.counter ? counts[it.counter] : 0;
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        onClick={onNavigate}
                        className={`mx-2.5 flex h-8 items-center justify-between rounded-lg px-2.5 text-sm hover:bg-neutral-100 ${active === it.href ? "bg-neutral-200 font-semibold" : ""}`}
                      >
                        <span>{it.label}</span>
                        {count > 0 && (
                          <span className="rounded-full bg-accent px-[7px] py-px text-[11px] font-semibold text-page">{count}</span>
                        )}
                      </Link>
                    );
                  })}
                </>
              )}
            </div>
          ))}
        </nav>
      )}

      <div className="flex flex-none items-center gap-2.5 border-t border-line px-[18px] py-3">
        <div className="flex size-[30px] flex-none items-center justify-center rounded-full bg-ink text-xs font-semibold text-page" title={user.name}>
          {initials(user.name)}
        </div>
        {!collapsed && (
          <>
            <Link href="/account" onClick={onNavigate} title="My account" className="flex min-w-0 flex-1 flex-col leading-tight hover:underline">
              <span className="truncate text-[13px] font-semibold">{user.name}</span>
              <span className="truncate text-xs text-secondary">{user.roleLabel}</span>
            </Link>
            <form action={signOutAction}>
              <button type="submit" className="btn btn-ghost p-1! text-xs">
                Sign out
              </button>
            </form>
          </>
        )}
      </div>
    </aside>
  );
}
