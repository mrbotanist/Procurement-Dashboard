// In-process scheduler for local hosting: runs the daily job at 00:05 business time,
// and once shortly after the server starts (in case the machine was off overnight).

import cron from "node-cron";
import { todayIso } from "@/lib/dates";
import { createPrismaClient } from "@/lib/prisma-client";
import { runDailyJob } from "./daily";
import { sendDigest } from "./digest";

const g = globalThis as unknown as { __fpvScheduler?: boolean };

export async function runJobNow(reason: string) {
  const db = createPrismaClient();
  try {
    const started = Date.now();
    const r = await runDailyJob(db, todayIso(), new Date());
    const digest = reason === "schedule" ? await sendDigest(db).catch((e) => ({ sent: 0, skipped: String(e) })) : null;
    console.log(
      `[daily-job] ${reason}: checked ${r.checked} open POs, ${r.changed.length} changed, ${r.notifications.created} new / ${r.notifications.autoResolved} auto-resolved notifications` +
        (digest ? `, digest: ${"skipped" in digest ? digest.skipped : `sent to ${digest.sent}`}` : "") +
        ` (${Date.now() - started} ms)`,
    );
    return r;
  } catch (e) {
    console.error(`[daily-job] ${reason} failed:`, e);
  } finally {
    await db.$disconnect();
  }
}

export function startScheduler() {
  if (g.__fpvScheduler) return;
  g.__fpvScheduler = true;
  const tz = process.env.APP_TIMEZONE || "Asia/Dubai";
  cron.schedule("5 0 * * *", () => void runJobNow("schedule"), { timezone: tz });
  setTimeout(() => void runJobNow("startup"), 15_000).unref?.();
  console.log(`[daily-job] scheduled for 00:05 ${tz}; first run in 15 s`);
}
