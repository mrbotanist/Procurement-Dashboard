// Run the daily job by hand: npm run jobs:daily   (add --digest to also email the digest)
import "dotenv/config";
import { todayIso } from "../src/lib/dates";
import { createPrismaClient } from "../src/lib/prisma-client";
import { runDailyJob } from "../src/server/jobs/daily";
import { sendDigest } from "../src/server/jobs/digest";

async function main() {
  const db = createPrismaClient();
  const r = await runDailyJob(db, todayIso(), new Date());
  console.log(`Checked ${r.checked} open POs. ${r.changed.length} changed.`);
  for (const c of r.changed) console.log(`  ${c.number}: ${Object.entries(c.changes).map(([k, [a, b]]) => `${k} ${a} → ${b}`).join(", ")}`);
  console.log(`Notifications: ${r.notifications.created} new, ${r.notifications.autoResolved} auto-resolved.`);
  if (process.argv.includes("--digest")) console.log("Digest:", await sendDigest(db));
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
