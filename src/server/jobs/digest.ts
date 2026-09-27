// Optional email digest of open critical/attention notifications.
// Enabled only when SMTP_URL is set (e.g. smtp://user:pass@smtp.example.com:587).

import type { Db } from "../recalc";
import { mailConfigured, sendMail } from "../mail";

export async function sendDigest(db: Db) {
  if (!mailConfigured()) return { sent: 0, skipped: "SMTP_URL not set" };
  const [open, users] = await Promise.all([
    db.notification.findMany({
      where: { resolvedAt: null, tone: { in: ["RED", "ORANGE"] } },
      orderBy: [{ tone: "asc" }, { createdAt: "desc" }],
      include: { po: { select: { number: true } } },
    }),
    db.user.findMany({ where: { active: true, role: { in: ["ADMIN", "PROCUREMENT_MANAGER", "FINANCE", "MANAGEMENT"] } }, select: { email: true } }),
  ]);
  if (!open.length || !users.length) return { sent: 0, skipped: "nothing to send" };
  const base = process.env.APP_URL || "http://localhost:3000";
  const lines = open.map((n) => `${n.tone === "RED" ? "●" : "○"} ${n.title}${n.detail ? ` — ${n.detail}` : ""}${n.po ? `\n   ${base}/orders/${n.po.number}` : ""}`);
  await sendMail({
    to: users.map((u) => u.email).join(", "),
    subject: `Procurement digest: ${open.filter((n) => n.tone === "RED").length} critical, ${open.filter((n) => n.tone === "ORANGE").length} need attention`,
    text: `Open items in FPV Procurement Hub:\n\n${lines.join("\n\n")}\n\nAction center: ${base}/actions\n`,
  });
  return { sent: users.length };
}
