// Two-step sign-in with a code sent by email. Pure helpers; the flow lives in src/server/login.ts.
//
// TWO_FACTOR in .env decides who needs a code:
//   off (default) · all · a list of roles, e.g. "ADMIN,FINANCE"

import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { Role } from "@/generated/prisma/enums";

export const OTP_TTL_MS = 10 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_SENDS = 4;
export const OTP_RESEND_COOLDOWN_MS = 30_000;

const OFF = new Set(["", "OFF", "NO", "FALSE", "0", "NONE"]);
const ALL = new Set(["ALL", "ON", "YES", "TRUE", "1"]);

/** The roles that must enter an emailed code, or "all" / "none". */
export function twoFactorScope(setting: string | undefined): "all" | "none" | Role[] {
  const v = (setting ?? "").trim().toUpperCase();
  if (OFF.has(v)) return "none";
  if (ALL.has(v)) return "all";
  return v.split(/[\s,]+/).filter(Boolean) as Role[];
}

export function requiresTwoFactor(role: Role, setting: string | undefined): boolean {
  const scope = twoFactorScope(setting);
  return scope === "all" || (scope !== "none" && scope.includes(role));
}

export const newChallengeId = () => randomBytes(32).toString("base64url");
export const generateCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

/** Accepts "123 456", "123-456" etc. Returns null unless exactly 6 digits remain. */
export function normalizeCode(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}

/** HMAC bound to the challenge, so a code hash can't be reused for another challenge. */
export function hashCode(secret: string, challengeId: string, code: string): string {
  return createHmac("sha256", secret).update(`${challengeId}:${code}`).digest("hex");
}

export function hashesMatch(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/** "rashid.khan@fpvstore.ae" → "ra•••••••@fpvstore.ae" */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return email;
  const name = email.slice(0, at);
  const keep = name.length <= 2 ? 1 : 2;
  return `${name.slice(0, keep)}${"•".repeat(Math.max(3, name.length - keep))}${email.slice(at)}`;
}
