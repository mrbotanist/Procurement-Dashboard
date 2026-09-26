"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity, runService, type ActionResult } from "./base";

async function toggle(id: string, resolve: boolean): Promise<ActionResult> {
  const res = await runService("notification:resolve", z.object({ id: z.string().min(1) }), { id }, async ({ user, tx, now }) => {
    const n = await tx.notification.findUniqueOrThrow({ where: { id } });
    if (!!n.resolvedAt === resolve) return undefined;
    await tx.notification.update({ where: { id }, data: { resolvedAt: resolve ? now : null } });
    await logActivity(tx, user, { poId: n.poId, kind: "SYSTEM", text: `${resolve ? "Resolved" : "Reopened"} notification: ${n.title}.`, entityType: "Notification", entityId: n.id });
    return undefined;
  });
  if (res.ok) revalidatePath("/", "layout");
  return res;
}

export async function resolveNotification(id: string) {
  return toggle(id, true);
}

export async function reopenNotification(id: string) {
  return toggle(id, false);
}

export async function resolveAllInfo(): Promise<ActionResult> {
  const res = await runService("notification:resolve", z.object({}), {}, async ({ user, tx, now }) => {
    const { count } = await tx.notification.updateMany({ where: { resolvedAt: null, tone: "BLUE" }, data: { resolvedAt: now } });
    if (count) await logActivity(tx, user, { kind: "SYSTEM", text: `Resolved ${count} info notifications.`, entityType: "Notification" });
    return undefined;
  });
  if (res.ok) revalidatePath("/", "layout");
  return res;
}
