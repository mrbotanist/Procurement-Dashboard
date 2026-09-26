"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export interface LoginState {
  error?: string;
  email?: string;
}

function safeCallback(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  // Only same-site paths; blocks "//evil.com" and absolute URLs.
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  try {
    await signIn("credentials", {
      email,
      password: String(formData.get("password") ?? ""),
      redirectTo: safeCallback(formData.get("callbackUrl")),
    });
    return {};
  } catch (e) {
    // signIn signals success by throwing a redirect; let that through.
    if (e instanceof AuthError) return { error: "Email or password is incorrect.", email };
    throw e;
  }
}
