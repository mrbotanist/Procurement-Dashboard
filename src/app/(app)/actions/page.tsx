import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/ui/ActionButton";
import { Page, PageHeader } from "@/components/ui/PageHeader";
import type { NotificationTone, Prisma } from "@/generated/prisma/client";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { relativeTime } from "@/server/queries/shell";
import { reopenNotification, resolveAllInfo, resolveNotification } from "@/server/services/notifications";

export const metadata: Metadata = { title: "Action Center" };

const TABS: { key: string; label: string; dot: string; where: Prisma.NotificationWhereInput }[] = [
  { key: "open", label: "All open", dot: "bg-ink", where: { resolvedAt: null } },
  { key: "critical", label: "Critical", dot: "bg-red-dot", where: { resolvedAt: null, tone: "RED" } },
  { key: "attention", label: "Needs attention", dot: "bg-orange-dot", where: { resolvedAt: null, tone: "ORANGE" } },
  { key: "updates", label: "Updates", dot: "bg-blue-dot", where: { resolvedAt: null, tone: "BLUE" } },
  { key: "resolved", label: "Resolved", dot: "bg-gray-dot", where: { resolvedAt: { not: null } } },
];
const BAR: Record<NotificationTone, string> = { RED: "bg-red-dot", ORANGE: "bg-orange-dot", BLUE: "bg-blue-dot" };

export default async function ActionsPage({ searchParams }: PageProps<"/actions">) {
  const user = await requirePermission("view:actions");
  const { tab: t } = await searchParams;
  const tab = TABS.find((x) => x.key === t) ?? TABS[0];
  const visible: Prisma.NotificationWhereInput = { OR: [{ userId: null }, { userId: user.id }] };
  const [counts, items] = await Promise.all([
    Promise.all(TABS.map((x) => db.notification.count({ where: { AND: [visible, x.where] } }))),
    db.notification.findMany({
      where: { AND: [visible, tab.where] },
      include: { po: { select: { number: true } } },
      orderBy: tab.key === "resolved" ? [{ resolvedAt: "desc" }] : [{ tone: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
  ]);
  const canResolve = can(user.role, "notification:resolve");

  return (
    <Page className="max-w-[1180px]! gap-4!">
      <PageHeader
        title="Action Center"
        subtitle="Notifications and pending actions. Resolve an item once it has been handled."
        actions={
          canResolve &&
          counts[3] > 0 && (
            <ActionButton action={resolveAllInfo} className="btn btn-secondary">
              Resolve all info items
            </ActionButton>
          )
        }
      />
      <div className="flex max-w-full flex-wrap self-start overflow-hidden rounded-[10px] border border-line bg-white">
        {TABS.map((x, i) => (
          <Link
            key={x.key}
            href={x.key === "open" ? "/actions" : `/actions?tab=${x.key}`}
            scroll={false}
            className={`flex items-center gap-2 border-r border-line px-3.5 py-2 text-[13px] last:border-r-0 ${tab.key === x.key ? "bg-ink text-page" : "hover:bg-page"}`}
          >
            <span className={`size-2 rounded-full ${x.dot} ${tab.key === x.key && x.key === "open" ? "bg-page!" : ""}`} />
            {x.label}
            <b>{counts[i]}</b>
          </Link>
        ))}
      </div>
      <div className="flex flex-col">
        {items.map((n) => (
          <div key={n.id} className={`grid grid-cols-[6px_minmax(0,1fr)] gap-4 border-b border-neutral-200 py-3.5 sm:grid-cols-[6px_minmax(0,1fr)_auto] ${n.resolvedAt ? "opacity-55" : ""}`}>
            <span className={BAR[n.tone]} />
            <div className="flex flex-col gap-0.5">
              <span className="text-[12.5px] text-secondary">
                {n.kind} · {relativeTime(n.createdAt)}
                {n.resolvedAt && ` · resolved ${relativeTime(n.resolvedAt)}`}
              </span>
              <span className="text-[17px] font-semibold">{n.title}</span>
              {n.detail && <span className="text-sm text-neutral-800">{n.detail}</span>}
            </div>
            <div className="col-start-2 flex items-center gap-2 sm:col-start-auto">
              {n.po && (
                <Link href={`/orders/${n.po.number}`} className="btn btn-secondary">
                  Open {n.po.number}
                </Link>
              )}
              {canResolve &&
                (n.resolvedAt ? (
                  <ActionButton action={reopenNotification.bind(null, n.id)} className="btn btn-ghost">
                    Reopen
                  </ActionButton>
                ) : (
                  <ActionButton action={resolveNotification.bind(null, n.id)} className="btn btn-ghost">
                    Resolve
                  </ActionButton>
                ))}
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="py-10 text-[15px] text-secondary">Nothing here.</div>}
      </div>
    </Page>
  );
}
