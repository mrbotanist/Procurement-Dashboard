"use client";

import { useRouter } from "next/navigation";
import { createContext, useActionState, useContext, useEffect, useRef } from "react";

type Result = { ok: true; data?: unknown; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> } | null;
type Action = (prev: Result, fd: FormData) => Promise<Result>;

const ErrorsCtx = createContext<Record<string, string[] | undefined>>({});

/**
 * Form bound to a service action. On success: go to `successHref`
 * (":id" is replaced by the returned id) or refresh and call `onDone`.
 */
export function ServiceForm({
  action,
  children,
  submitLabel = "Save",
  successHref,
  onDone,
  cancel,
  className = "",
  resetOnSuccess = false,
  hideSubmit = false,
}: {
  action: Action;
  children: React.ReactNode;
  submitLabel?: string;
  successHref?: string;
  onDone?: () => void;
  cancel?: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  hideSubmit?: boolean;
}) {
  const [state, formAction, pending] = useActionState<Result, FormData>(action, null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const handled = useRef<Result>(null);

  useEffect(() => {
    if (!state?.ok || handled.current === state) return;
    handled.current = state;
    const id = (state.data as { id?: string } | undefined)?.id;
    if (successHref) router.push(id ? successHref.replace(":id", id) : successHref);
    else router.refresh();
    if (resetOnSuccess) formRef.current?.reset();
    onDone?.();
  }, [state, successHref, router, onDone, resetOnSuccess]);

  return (
    <ErrorsCtx.Provider value={state && !state.ok ? (state.fieldErrors ?? {}) : {}}>
      <form ref={formRef} action={formAction} className={`flex flex-col gap-4 ${className}`} noValidate>
        {children}
        {state && !state.ok && (
          <p role="alert" className="rounded-[10px] bg-red-bg px-3 py-2 text-[13px] font-medium text-red-fg">
            {state.error}
          </p>
        )}
        {!hideSubmit && (
          <div className="flex justify-end gap-2">
            {cancel}
            <button type="submit" disabled={pending} className="btn btn-primary">
              {pending ? "Saving…" : submitLabel}
            </button>
          </div>
        )}
      </form>
    </ErrorsCtx.Provider>
  );
}

export function useFieldError(name: string) {
  return useContext(ErrorsCtx)[name]?.[0];
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; hint?: string };

export function Field({ label, name, hint, className = "", ...rest }: InputProps) {
  const err = useFieldError(name);
  const id = `f-${name}`;
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} className={`input ${err ? "border-red-dot!" : ""}`} aria-invalid={!!err} aria-describedby={err ? `${id}-err` : undefined} {...rest} />
      {err ? (
        <p id={`${id}-err`} className="mt-1 text-xs text-red-fg">
          {err}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  name,
  options,
  className = "",
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string; options: { value: string; label: string }[] }) {
  const err = useFieldError(name);
  const id = `f-${name}`;
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <select id={id} name={name} className={`input ${err ? "border-red-dot!" : ""}`} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {err && <p className="mt-1 text-xs text-red-fg">{err}</p>}
    </div>
  );
}

export function TextArea({ label, name, className = "", ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; name: string }) {
  const err = useFieldError(name);
  const id = `f-${name}`;
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <textarea id={id} name={name} className="input min-h-[90px] resize-y" {...rest} />
      {err && <p className="mt-1 text-xs text-red-fg">{err}</p>}
    </div>
  );
}
