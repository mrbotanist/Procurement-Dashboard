// Sign-in checks shared by the login action and the Auth.js credentials provider:
// password (with the per-email failure limit) and the emailed one-time code.

import "server-only";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Role } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { isLimited, recordFailure, resetLimit } from "@/lib/rate-limit";
import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  generateCode,
  hashCode,
  hashesMatch,
  maskEmail,
  newChallengeId,
  normalizeCode,
} from "@/lib/auth/two-factor";
import { logServerError } from "./error-log";
import { mailConfigured, sendMail } from "./mail";

const WINDOW = 15 * 60_000;
// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export interface LoginUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

const emailSchema = z.email().transform((e) => e.toLowerCase().trim());
const limitKey = (email: string) => `login:${email}`;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

export type PasswordResult = { ok: true; user: LoginUser } | { ok: false; reason: "invalid" | "rate_limited" };

/** After 5 failed attempts for an email (wrong passwords or wrong codes), block it for 15 minutes. */
export async function checkPassword(rawEmail: unknown, rawPassword: unknown): Promise<PasswordResult> {
  const email = emailSchema.safeParse(rawEmail);
  const password = z.string().min(1).max(200).safeParse(rawPassword);
  if (!email.success || !password.success) return { ok: false, reason: "invalid" };
  const key = limitKey(email.data);
  if (isLimited(key, 5, WINDOW)) return { ok: false, reason: "rate_limited" };
  const user = await db.user.findUnique({ where: { email: email.data } });
  const match = await bcrypt.compare(password.data, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.active || !match) {
    recordFailure(key, WINDOW);
    return { ok: false, reason: "invalid" };
  }
  resetLimit(key);
  return { ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

const codeEmail = (code: string) => ({
  subject: `${code} is your FPV Procurement Hub sign-in code`,
  text:
    `Your sign-in code is: ${code}\n\n` +
    `It expires in ${OTP_TTL_MS / 60_000} minutes and can be used once.\n\n` +
    `If you didn't just try to sign in, someone knows your password: change it under My account and tell your administrator.\n`,
});

async function deliver(to: string, code: string): Promise<boolean> {
  try {
    await sendMail({ to, ...codeEmail(code) });
    return true;
  } catch (e) {
    console.error("[login] sign-in code email failed:", e);
    await logServerError({ message: `Sign-in code email to ${to} failed: ${String(e)}`, source: "login" });
    return false;
  }
}

export type ChallengeResult = { ok: true; challengeId: string; maskedEmail: string } | { ok: false; error: string };

const MAIL_BROKEN = "We couldn't send your sign-in code. Ask your administrator to check the email settings (SMTP_URL).";

/** Call only after checkPassword succeeded. Replaces any earlier unused code for the user. */
export async function startChallenge(user: LoginUser): Promise<ChallengeResult> {
  if (!mailConfigured()) {
    await logServerError({ message: "TWO_FACTOR is on but SMTP_URL is not set; sign-in codes can't be sent.", source: "login" });
    return { ok: false, error: MAIL_BROKEN };
  }
  const sendKey = `otp-send:${user.id}`;
  if (isLimited(sendKey, 6, WINDOW)) return { ok: false, error: "Too many codes requested. Wait 15 minutes and try again." };
  recordFailure(sendKey, WINDOW); // counts sends, not failures

  const id = newChallengeId();
  const code = generateCode();
  await db.loginChallenge.deleteMany({ where: { userId: user.id, usedAt: null } });
  await db.loginChallenge.create({
    data: { id, userId: user.id, codeHash: hashCode(secret(), id, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });
  if (!(await deliver(user.email, code))) {
    await db.loginChallenge.delete({ where: { id } });
    return { ok: false, error: MAIL_BROKEN };
  }
  return { ok: true, challengeId: id, maskedEmail: maskEmail(user.email) };
}

/** Sends a fresh code for the same challenge (the old code stops working). */
export async function resendChallenge(challengeId: string): Promise<{ ok: true } | { ok: false; error: string; restart?: boolean }> {
  const ch = await db.loginChallenge.findUnique({ where: { id: challengeId }, include: { user: true } });
  if (!ch || ch.usedAt || !ch.user.active || ch.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, error: "This sign-in has expired. Enter your password again.", restart: true };
  if (ch.sends >= OTP_MAX_SENDS) return { ok: false, error: "No more codes can be sent for this sign-in. Enter your password again.", restart: true };
  const wait = ch.lastSentAt.getTime() + OTP_RESEND_COOLDOWN_MS - Date.now();
  if (wait > 0) return { ok: false, error: `Wait ${Math.ceil(wait / 1000)} seconds before asking for another code.` };
  const code = generateCode();
  await db.loginChallenge.update({
    where: { id: ch.id },
    data: { codeHash: hashCode(secret(), ch.id, code), sends: { increment: 1 }, lastSentAt: new Date(), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });
  return (await deliver(ch.user.email, code)) ? { ok: true } : { ok: false, error: MAIL_BROKEN };
}

export type CodeResult = { ok: true; user: LoginUser } | { ok: false; reason: "invalid" | "expired" | "rate_limited" };

export async function verifyCode(rawChallengeId: unknown, rawCode: unknown): Promise<CodeResult> {
  if (typeof rawChallengeId !== "string" || typeof rawCode !== "string" || rawChallengeId.length > 100) return { ok: false, reason: "expired" };
  const ch = await db.loginChallenge.findUnique({ where: { id: rawChallengeId }, include: { user: true } });
  if (!ch || ch.usedAt || ch.expiresAt.getTime() < Date.now() || !ch.user.active) return { ok: false, reason: "expired" };
  const key = limitKey(ch.user.email);
  if (isLimited(key, 5, WINDOW)) return { ok: false, reason: "rate_limited" };
  // Count the attempt before comparing, atomically, so parallel guesses can't exceed the limit.
  const counted = await db.loginChallenge.updateMany({
    where: { id: ch.id, usedAt: null, attempts: { lt: OTP_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (!counted.count) return { ok: false, reason: "expired" };
  const code = normalizeCode(rawCode);
  if (!code || !hashesMatch(hashCode(secret(), ch.id, code), ch.codeHash)) {
    recordFailure(key, WINDOW);
    return { ok: false, reason: "invalid" };
  }
  const used = await db.loginChallenge.updateMany({ where: { id: ch.id, usedAt: null }, data: { usedAt: new Date() } });
  if (!used.count) return { ok: false, reason: "expired" };
  resetLimit(key);
  const u = ch.user;
  return { ok: true, user: { id: u.id, name: u.name, email: u.email, role: u.role } };
}
