// Daily job: dates move even when data doesn't. Marks overdue payments and late production,
// recomputes health for every open PO, then refreshes notifications.

import type { IsoDate } from "@/lib/dates";
import { PAYMENT_STATUS_LABEL, PRODUCTION_STATUS_LABEL } from "@/lib/status";
import { recalcPo, type Db } from "../recalc";
import { syncNotifications } from "./notifications";

export async function runDailyJob(db: Db, today: IsoDate, now: Date) {
  const open = await db.purchaseOrder.findMany({ where: { poStatus: { notIn: ["CLOSED", "CANCELLED"] } }, select: { id: true } });
  const changed: { number: string; changes: Record<string, [string, string]> }[] = [];
  for (const { id } of open) {
    const r = await recalcPo(db, id, today);
    if (Object.keys(r.changes).length) {
      changed.push({ number: r.number, changes: r.changes });
      const statusChanges = Object.entries(r.changes).filter(([k]) => k === "paymentStatus" || k === "productionStatus");
      if (statusChanges.length) {
        await db.activityLog.create({
          data: {
            poId: id,
            actorLabel: "System",
            kind: "SYSTEM",
            text: statusChanges
              .map(([k, [from, to]]) => {
                const labels: Record<string, string> = k === "paymentStatus" ? PAYMENT_STATUS_LABEL : PRODUCTION_STATUS_LABEL;
                return `${k === "paymentStatus" ? "Payment" : "Production"} status changed from ${labels[from]} to ${labels[to]}.`;
              })
              .join(" "),
            before: Object.fromEntries(statusChanges.map(([k, [from]]) => [k, from])),
            after: Object.fromEntries(statusChanges.map(([k, [, to]]) => [k, to])),
          },
        });
      }
    }
  }
  const notifications = await syncNotifications(db, today, now);
  return { checked: open.length, changed, notifications };
}
