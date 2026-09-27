"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { requiresTwoFactor } from "@/lib/auth/two-factor";
import { checkPassword, resendChallenge, startChallenge } from "@/server/login";

export interface LoginState {
  step?: "password" | "code";
  error?: string;
  info?: string;
  email?: string;
  challengeId?: string;
  maskedEmail?: string;
}

const RATE_LIMITED = "Too many sign-in attempts. Wait 15 minutes and try again.";

function safeCallback(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  // Only same-site paths; blocks "//evil.com" and absolute URLs.
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

const authCode = (e: unknown) => (e instanceof AuthError ? ((e as AuthError & { code?: string }).code ?? "credentials") : null);

export async function login(prev: LoginState, formData: FormData): Promise<LoginState> {
  const intent = String(formData.get("intent") ?? "password");
  const redirectTo = safeCallback(formData.get("callbackUrl"));

  if (intent === "restart") return { email: prev.email };

  if (intent === "resend" || intent === "code") {
    const challengeId = String(formData.get("challengeId") ?? "");
    const codeStep = { step: "code" as const, email: prev.email, challengeId, maskedEmail: prev.maskedEmail };
    if (intent === "resend") {
      const r = await resendChallenge(challengeId);
      if (r.ok) return { ...codeStep, info: "We sent a new code. The previous one no longer works." };
      return r.restart ? { email: prev.email, error: r.error } : { ...codeStep, error: r.error };
    }
    try {
      await signIn("credentials", { challengeId, code: String(formData.get("code") ?? ""), redirectTo });
      return {};
    } catch (e) {
      const code = authCode(e);
      if (!code) throw e; // signIn signals success by throwing a redirect; let that through.
      if (code === "code_invalid") return { ...codeStep, error: "That code isn't right. Check the latest email and try again." };
      if (code === "rate_limited") return { email: prev.email, error: RATE_LIMITED };
      return { email: prev.email, error: "That code has expired or was used too many times. Sign in again to get a new one." };
    }
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const checked = await checkPassword(email, password);
  if (!checked.ok) return { email, error: checked.reason === "rate_limited" ? RATE_LIMITED : "Email or password is incorrect." };

  if (requiresTwoFactor(checked.user.role, process.env.TWO_FACTOR)) {
    const ch = await startChallenge(checked.user);
    if (!ch.ok) return { email, error: ch.error };
    return { step: "code", email, challengeId: ch.challengeId, maskedEmail: ch.maskedEmail };
  }

  try {
    await signIn("credentials", { email, password, redirectTo });
    return {};
  } catch (e) {
    const code = authCode(e);
    if (!code) throw e;
    return { email, error: code === "rate_limited" ? RATE_LIMITED : "Email or password is incorrect." };
  }
}
