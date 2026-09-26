"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { ROLE_LABEL } from "@/lib/status";
import { changePasswordSchema, createUserSchema, updateUserSchema } from "@/lib/validation/users";
import { formToObject, logActivity, runService, UserError, type ActionResult } from "./base";

export async function createUser(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const res = await runService("user:manage", createUserSchema, formToObject(fd), async ({ user, input, tx }) => {
    const u = await tx.user.create({ data: { name: input.name, email: input.email, role: input.role, passwordHash: await bcrypt.hash(input.password, 10) } });
    await logActivity(tx, user, { kind: "SYSTEM", text: `Created user ${u.name} (${ROLE_LABEL[u.role]}).`, entityType: "User", entityId: u.id });
    return undefined;
  });
  if (res.ok) revalidatePath("/settings");
  return res;
}

export async function updateUser(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const res = await runService("user:manage", updateUserSchema, formToObject(fd), async ({ user, input, tx }) => {
    const before = await tx.user.findUniqueOrThrow({ where: { id: input.userId } });
    if (before.id === user.id && (input.role !== "ADMIN" || !input.active)) throw new UserError("You can't remove your own admin access.");
    if (before.role === "ADMIN" && (input.role !== "ADMIN" || !input.active)) {
      const admins = await tx.user.count({ where: { role: "ADMIN", active: true } });
      if (admins <= 1) throw new UserError("Keep at least one active admin.");
    }
    await tx.user.update({
      where: { id: before.id },
      data: { name: input.name, role: input.role, active: input.active, ...(input.password ? { passwordHash: await bcrypt.hash(input.password, 10) } : {}) },
    });
    const changes = [
      before.name !== input.name && "name",
      before.role !== input.role && `role ${ROLE_LABEL[before.role]} → ${ROLE_LABEL[input.role]}`,
      before.active !== input.active && (input.active ? "reactivated" : "deactivated"),
      input.password && "password reset",
    ].filter(Boolean);
    if (changes.length) {
      await logActivity(tx, user, {
        kind: "SYSTEM",
        text: `Updated user ${input.name}: ${changes.join(", ")}.`,
        entityType: "User",
        entityId: before.id,
        before: { role: before.role, active: before.active },
        after: { role: input.role, active: input.active },
      });
    }
    return undefined;
  });
  if (res.ok) revalidatePath("/settings");
  return res;
}

export async function changeOwnPassword(_prev: unknown, fd: FormData): Promise<ActionResult> {
  // Everyone may change their own password; view:dashboard is held by every role.
  return runService("view:dashboard", changePasswordSchema, formToObject(fd), async ({ user, input, tx }) => {
    const me = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await bcrypt.compare(input.current, me.passwordHash))) throw new UserError("Your current password is incorrect.");
    await tx.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(input.password, 10) } });
    await logActivity(tx, user, { kind: "SYSTEM", text: "Changed own password.", entityType: "User", entityId: me.id });
    return undefined;
  });
}
