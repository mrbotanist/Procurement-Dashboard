"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="flex w-full max-w-[380px] flex-col gap-4">
      <div>
        <h2 className="mb-1.5 text-[26px]">Sign in</h2>
        <p className="text-sm text-secondary">Use your company account.</p>
      </div>
      <div className="h-0.5 bg-line" />
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <div className="field">
        <label htmlFor="email">Work email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" defaultValue={state.email} autoFocus />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      {state.error && (
        <p role="alert" className="rounded-[10px] bg-red-bg px-3 py-2 text-[13px] font-medium text-red-fg">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary justify-between! px-3.5 py-3 text-[15px]">
        {pending ? "Signing in…" : "Sign in"}
        <span aria-hidden>→</span>
      </button>
      <span className="text-[13px] text-secondary">Trouble signing in? Contact your administrator.</span>
    </form>
  );
}
