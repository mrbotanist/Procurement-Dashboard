"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, PanelLeft, Plus, Search } from "lucide-react";
import { NotificationsPopover, type HeaderNotification } from "./NotificationsPopover";

export const RANGES = [
  { key: "30d", label: "30 days" },
  { key: "quarter", label: "Quarter" },
  { key: "ytd", label: "YTD" },
] as const;

interface Props {
  notifications: HeaderNotification[];
  unresolved: number;
  canCreatePo: boolean;
  onToggleSidebar: () => void;
  onOpenDrawer: () => void;
}

export function Header({ notifications, unresolved, canCreatePo, onToggleSidebar, onOpenDrawer }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(pathname === "/orders" ? (params.get("q") ?? "") : "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const range = params.get("range") ?? "ytd";

  useEffect(() => () => clearTimeout(timer.current), []);

  // Typing jumps to the PO list with the query (as in the prototype).
  function onQuery(value: string) {
    setQuery(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const url = value.trim() ? `/orders?q=${encodeURIComponent(value.trim())}` : "/orders";
      if (pathname === "/orders") router.replace(url);
      else if (value.trim()) router.push(url);
    }, 250);
  }

  function rangeHref(key: string) {
    const next = new URLSearchParams(params);
    if (key === "ytd") next.delete("range");
    else next.set("range", key);
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <header className="relative z-20 flex h-16 flex-none items-center gap-3 border-b border-line px-4 md:px-6">
      <button type="button" onClick={onOpenDrawer} title="Open menu" aria-label="Open menu" className="btn btn-secondary btn-icon lg:hidden">
        <Menu size={16} />
      </button>
      <button type="button" onClick={onToggleSidebar} title="Collapse sidebar" aria-label="Toggle sidebar" className="btn btn-secondary btn-icon hidden lg:inline-flex">
        <PanelLeft size={16} />
      </button>
      <div className="relative flex max-w-[460px] min-w-[140px] flex-[1_1_160px] items-center">
        <Search size={15} className="pointer-events-none absolute left-2.5 text-neutral-600" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search PO, supplier, brand, SKU, tracking or invoice"
          aria-label="Search"
          className="input pl-8!"
        />
      </div>
      <div className="flex-1" />
      <div className="seg hidden flex-none min-[1181px]:inline-flex" role="group" aria-label="Date range">
        {RANGES.map((r, i) => (
          <Link
            key={r.key}
            href={rangeHref(r.key)}
            replace
            scroll={false}
            className={`px-3 py-[7px] text-[13px] whitespace-nowrap ${i ? "border-l border-line" : ""} ${range === r.key ? "bg-ink text-page" : "hover:bg-page"}`}
          >
            {r.label}
          </Link>
        ))}
      </div>
      <NotificationsPopover items={notifications} unresolved={unresolved} />
      {canCreatePo && (
        <Link href="/orders/new" className="btn btn-primary h-9">
          <Plus size={15} strokeWidth={2.4} />
          <span className="hidden min-[1181px]:inline">Create Purchase Order</span>
          <span className="min-[1181px]:hidden">New PO</span>
        </Link>
      )}
    </header>
  );
}
