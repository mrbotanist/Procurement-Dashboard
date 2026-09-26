import "server-only";
import { db } from "@/lib/db";
import type { HeaderNotification } from "@/components/shell/NotificationsPopover";

export function relativeTime(then: Date, now = new Date()): string {
  const mins = Math.round((now.getTime() - then.getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return "Yesterday";
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Data the header and sidebar need on every page. */
export async function getShellData(userId: string) {
  const visible = { resolvedAt: null, OR: [{ userId: null }, { userId }] };
  const [unresolved, latest] = await Promise.all([
    db.notification.count({ where: visible }),
    db.notification.findMany({
      where: visible,
      orderBy: [{ tone: "asc" }, { createdAt: "desc" }],
      take: 6,
      select: { id: true, title: true, tone: true, createdAt: true, po: { select: { number: true } } },
    }),
  ]);

  const notifications: HeaderNotification[] = latest.map((n) => ({
    id: n.id,
    title: n.title,
    tone: n.tone,
    time: relativeTime(n.createdAt),
    href: n.po ? `/orders/${n.po.number}` : "/actions",
  }));

  return { unresolved, notifications };
}
