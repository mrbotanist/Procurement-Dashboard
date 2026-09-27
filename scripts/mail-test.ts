// Check the email settings: npm run mail:test -- you@yourstore.ae
import "dotenv/config";
import { mailConfigured, sendMail } from "../src/server/mail";

async function main() {
  const to = process.argv[2];
  if (!to || !to.includes("@")) throw new Error("Usage: npm run mail:test -- you@yourstore.ae");
  if (!mailConfigured()) throw new Error("SMTP_URL is not set in .env");
  await sendMail({
    to,
    subject: "FPV Procurement Hub test email",
    text: "Email is working. Sign-in codes and the nightly digest will arrive like this.\n",
  });
  console.log(`Sent a test email to ${to}${process.env.SMTP_URL === "console" ? " (console mode: see logs/mail.log)" : ""}.`);
}

main().catch((e) => {
  console.error(`Email failed: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
