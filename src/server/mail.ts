// Outgoing email (sign-in codes, nightly digest).
//   SMTP_URL="smtp://user:password@smtp.example.com:587"  → sends through that server
//   SMTP_URL="console"  → no email; prints it and appends it to logs/mail.log (testing only)

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export const mailConfigured = () => !!process.env.SMTP_URL;

const from = () => process.env.MAIL_FROM || process.env.DIGEST_FROM || "FPV Procurement Hub <no-reply@localhost>";

export async function sendMail(mail: Mail) {
  const url = process.env.SMTP_URL;
  if (!url) throw new Error("SMTP_URL is not set");
  if (url === "console") {
    const entry = `--- ${new Date().toISOString()}\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n`;
    console.log(`[mail] ${entry}`);
    const dir = path.join(process.cwd(), "logs");
    await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
    await appendFile(/*turbopackIgnore: true*/ path.join(dir, "mail.log"), entry);
    return;
  }
  const nodemailer = await import("nodemailer");
  await nodemailer.createTransport(url).sendMail({ from: from(), ...mail });
}
