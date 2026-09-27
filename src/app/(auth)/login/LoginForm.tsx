"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const codeStep = state.step === "code";

  return (
    <form action={action} className="flex w-full max-w-[380px] flex-col gap-4">
      <div>
        <h2 className="mb-1.5 text-[26px]">{codeStep ? "Check your email" : "Sign in"}</h2>
        <p className="text-sm text-secondary">
          {codeStep ? (
            <>
              We sent a 6-digit code to <span className="font-medium text-ink">{state.maskedEmail}</span>. It expires in 10 minutes.
            </>
          ) : (
            "Use your company account."
          )}
        </p>
      </div>
      <div className="h-0.5 bg-line" />
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      {codeStep ? (
        <>
          <input type="hidden" name="challengeId" value={state.challengeId} />
          <div className="field">
            <label htmlFor="code">Sign-in code</label>
            <input
              key={state.challengeId}
              id="code"
              name="code"
              required
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 \-]{6,9}"
              maxLength={9}
              placeholder="123456"
              className="input text-[20px] tracking-[0.3em] tabular-nums"
            />
          </div>
        </>
      ) : (
        <>
          <div className="field">
            <label htmlFor="email">Work email</label>
            <input id="email" name="email" type="email" autoComplete="username" required className="input" defaultValue={state.email} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
          </div>
        </>
      )}
      {state.error && (
        <p role="alert" className="rounded-[10px] bg-red-bg px-3 py-2 text-[13px] font-medium text-red-fg">
          {state.error}
        </p>
      )}
      {state.info && !state.error && (
        <p role="status" className="rounded-[10px] bg-blue-bg px-3 py-2 text-[13px] font-medium text-blue-fg">
          {state.info}
        </p>
      )}
      <button type="submit" name="intent" value={codeStep ? "code" : "password"} disabled={pending} className="btn btn-primary justify-between! px-3.5 py-3 text-[15px]">
        {pending ? (codeStep ? "Checking…" : "Signing in…") : codeStep ? "Verify and sign in" : "Sign in"}
        <span aria-hidden>→</span>
      </button>
      {codeStep ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
          <button type="submit" name="intent" value="resend" formNoValidate disabled={pending} className="font-medium text-ink underline underline-offset-2">
            Send a new code
          </button>
          <button type="submit" name="intent" value="restart" formNoValidate disabled={pending} className="text-secondary hover:text-ink">
            Use a different account
          </button>
        </div>
      ) : (
        <span className="text-[13px] text-secondary">Trouble signing in? Contact your administrator.</span>
      )}
    </form>
  );
}
