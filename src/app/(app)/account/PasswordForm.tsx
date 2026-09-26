"use client";

import { useState } from "react";
import { Field, ServiceForm } from "@/components/ui/Form";
import { changeOwnPassword } from "@/server/services/users";

export function PasswordForm() {
  const [done, setDone] = useState(false);
  return (
    <ServiceForm action={changeOwnPassword} submitLabel="Change password" resetOnSuccess onDone={() => setDone(true)}>
      <Field label="Current password" name="current" type="password" autoComplete="current-password" required />
      <Field label="New password" name="password" type="password" autoComplete="new-password" hint="At least 10 characters" required />
      <Field label="Repeat new password" name="confirm" type="password" autoComplete="new-password" required />
      {done && <p className="rounded-[10px] bg-green-bg px-3 py-2 text-[13px] font-medium text-green-fg">Password changed.</p>}
    </ServiceForm>
  );
}
