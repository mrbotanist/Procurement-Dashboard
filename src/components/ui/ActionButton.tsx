"use client";

import { useState, useTransition } from "react";

type Result = { ok: true } | { ok: false; error: string };

/** Button that runs a bound server action; optional confirm prompt; shows errors inline. */
export function ActionButton({
  action,
  children,
  className = "btn btn-secondary",
  confirm,
  prompt,
}: {
  action: (arg?: string) => Promise<Result>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  prompt?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        className={className}
        onClick={() => {
          let arg: string | undefined;
          if (prompt) {
            const v = window.prompt(prompt);
            if (!v?.trim()) return;
            arg = v.trim();
          } else if (confirm && !window.confirm(confirm)) return;
          setError(null);
          start(async () => {
            const r = await action(arg);
            if (!r.ok) setError(r.error);
          });
        }}
      >
        {pending ? "Working…" : children}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-fg">
          {error}
        </span>
      )}
    </span>
  );
}
