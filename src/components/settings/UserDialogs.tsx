"use client";

import { Dialog } from "@/components/ui/Dialog";
import { Field, SelectField, ServiceForm } from "@/components/ui/Form";
import { ROLE_LABEL } from "@/lib/status";
import { ROLES } from "@/lib/validation/users";
import { createUser, updateUser } from "@/server/services/users";

const roleOptions = ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }));

export function NewUserDialog() {
  return (
    <Dialog title="Add user" trigger={(open) => <button type="button" onClick={open} className="btn btn-primary">+ Add user</button>}>
      {(close) => (
        <ServiceForm action={createUser} onDone={close} submitLabel="Create user">
          <Field label="Name" name="name" required />
          <Field label="Work email" name="email" type="email" required />
          <SelectField label="Role" name="role" defaultValue="PROCUREMENT_MANAGER" options={roleOptions} />
          <Field label="Temporary password" name="password" type="password" autoComplete="new-password" hint="At least 10 characters. Ask them to change it after signing in." required />
        </ServiceForm>
      )}
    </Dialog>
  );
}

export function EditUserDialog({ user }: { user: { id: string; name: string; role: string; active: boolean } }) {
  return (
    <Dialog title={`Edit ${user.name}`} trigger={(open) => <button type="button" onClick={open} className="btn btn-ghost px-2! py-1! text-[13px]">Edit</button>}>
      {(close) => (
        <ServiceForm action={updateUser} onDone={close}>
          <input type="hidden" name="userId" value={user.id} />
          <Field label="Name" name="name" defaultValue={user.name} required />
          <SelectField label="Role" name="role" defaultValue={user.role} options={roleOptions} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={user.active} /> Active (can sign in)
          </label>
          <Field label="New password (optional)" name="password" type="password" autoComplete="new-password" hint="Leave empty to keep the current password." />
        </ServiceForm>
      )}
    </Dialog>
  );
}
