import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { can, type Permission } from "./permissions";

/**
 * The signed-in user, re-read from the database so deactivated users and
 * role changes take effect immediately (the JWT alone could be stale).
 */
export const currentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  return user?.active ? user : null;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

export async function requireUser(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

/** For pages: users without access are sent to the dashboard. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/");
  return user;
}

export class ForbiddenError extends Error {
  constructor(permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "ForbiddenError";
  }
}

/** For server actions and route handlers: throws instead of redirecting. */
export async function assertPermission(permission: Permission): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user || !can(user.role, permission)) throw new ForbiddenError(permission);
  return user;
}
