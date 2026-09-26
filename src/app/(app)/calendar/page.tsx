import type { Metadata } from "next";
import Link from "next/link";
import { Page, PageHeader } from "@/components/ui/PageHeader";
import { requirePermission } from "@/lib/auth/session";
import { addDays, todayIso } from "@/lib/dates";
import { EVENT_TYPES } from "@/lib/domain/calendar";
import { MONL } from "@/lib/format";
import { eventsBetween } from "@/server/queries/insights";

export const metadata: Metadata = { title: "Purchase Calendar" };

const COLOR: Record<string, string> = { Payment: "bg-ev-payment", Production: "bg-ev-production", Shipment: "bg-ev-shipment", Customs: "bg-ev-customs", Arrival: "bg-ev-arrival" };

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  await requirePermission("view:calendar");
  const sp = await searchParams;
  const today = todayIso();
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const off = new Set(typeof sp.off === "string" ? sp.off.split(",") : []);
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const lead = (new Date(first + "T00:00:00Z").getUTCDay() + 6) % 7; // Monday first
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const total = Math.ceil((lead + dim) / 7) * 7;
  const start = addDays(first, -lead);
  const events = (await eventsBetween(start, addDays(start, total - 1))).filter((e) => !off.has(e.type));
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const href = (patch: { month?: string; off?: Set<string> }) => {
    const q = new URLSearchParams();
    q.set("month", patch.month ?? month);
    const o = patch.off ?? off;
    if (o.size) q.set("off", [...o].join(","));
    return `/calendar?${q}`;
  };

  return (
    <Page className="gap-4!">
      <PageHeader
        title="Procurement Calendar"
        subtitle="Payments, production milestones, shipments, customs and arrivals."
        actions={
          <div className="flex items-center gap-2">
            <Link href={href({ month: shift(-1) })} className="btn btn-secondary btn-icon" aria-label="Previous month">
              ←
            </Link>
            <span className="min-w-[150px] text-center text-lg font-semibold">
              {MONL[m - 1]} {y}
            </span>
            <Link href={href({ month: shift(1) })} className="btn btn-secondary btn-icon" aria-label="Next month">
              →
            </Link>
            <Link href={href({ month: today.slice(0, 7) })} className="btn btn-secondary">
              Today
            </Link>
          </div>
        }
      />
      <div className="flex flex-wrap gap-2">
        {EVENT_TYPES.map((t) => {
          const next = new Set(off);
          if (next.has(t)) next.delete(t);
          else next.add(t);
          return (
            <Link key={t} href={href({ off: next })} scroll={false} aria-pressed={!off.has(t)} className={`flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-[13px] ${off.has(t) ? "opacity-40" : ""}`}>
              <span className={`size-2.5 rounded-full ${COLOR[t]}`} />
              {t === "Arrival" ? "Expected arrival" : t}
            </Link>
          );
        })}
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[840px] grid-cols-7 overflow-hidden rounded-card border border-line bg-white">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="border-b border-line px-2.5 py-2 text-[12.5px] text-secondary">
              {d}
            </div>
          ))}
          {Array.from({ length: total }, (_, i) => {
            const day = addDays(start, i);
            const inMonth = day.startsWith(month);
            const isToday = day === today;
            const evs = events.filter((e) => e.date === day);
            return (
              <div key={day} className={`flex min-h-[110px] flex-col gap-1 border-r border-b border-line p-1.5 [&:nth-child(7n)]:border-r-0 ${inMonth ? "" : "bg-neutral-100"}`}>
                <span className={`flex size-6 items-center justify-center rounded-full text-[13px] ${isToday ? "bg-ink font-bold text-page" : inMonth ? "" : "text-neutral-500"}`}>{Number(day.slice(8))}</span>
                {evs.slice(0, 4).map((e, j) => (
                  <Link key={j} href={`/orders/${e.poNumber}`} title={`${e.title} · ${e.poNumber}`} className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-surface">
                    <span className={`size-2 flex-none rounded-full ${COLOR[e.type]}`} />
                    <span className="truncate">{e.title}</span>
                  </Link>
                ))}
                {evs.length > 4 && <span className="px-1 text-xs text-secondary">+{evs.length - 4} more</span>}
              </div>
            );
          })}
        </div>
      </div>
    </Page>
  );
}
