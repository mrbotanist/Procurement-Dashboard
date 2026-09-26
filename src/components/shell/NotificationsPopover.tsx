"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

export interface HeaderNotification {
  id: string;
  title: string;
  time: string;
  tone: "RED" | "ORANGE" | "BLUE";
  href: string;
}

const DOT = { RED: "bg-red-dot", ORANGE: "bg-orange-dot", BLUE: "bg-blue-dot" } as const;

export function NotificationsPopover({ items, unresolved }: { items: HeaderNotification[]; unresolved: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        aria-label={`Notifications, ${unresolved} unresolved`}
        aria-expanded={open}
        className="btn btn-secondary btn-icon relative"
      >
        <Bell size={16} />
        {unresolved > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-[5px] text-[11px] font-semibold text-page">
            {unresolved}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-[46px] right-0 w-[min(400px,calc(100vw-32px))] overflow-hidden rounded-[14px] border border-line bg-white shadow-pop">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-[15px] font-semibold">Notifications</span>
            <span className="text-xs text-secondary">{unresolved} unresolved</span>
          </div>
          {items.length === 0 && <p className="px-4 py-6 text-sm text-secondary">You&apos;re all caught up.</p>}
          {items.map((n) => (
            <Link
              key={n.id}
              href={n.href}
              onClick={() => setOpen(false)}
              className="grid grid-cols-[10px_1fr] gap-3 border-b border-neutral-200 px-4 py-3 hover:bg-surface"
            >
              <span className={`mt-[5px] size-2.5 rounded-full ${DOT[n.tone]}`} />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{n.title}</span>
                <span className="text-xs text-secondary">{n.time}</span>
              </span>
            </Link>
          ))}
          <Link href="/actions" onClick={() => setOpen(false)} className="btn w-full justify-between! rounded-none! px-4 py-3">
            Open action center<span aria-hidden>→</span>
          </Link>
        </div>
      )}
    </div>
  );
}
