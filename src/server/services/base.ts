import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { todayIso } from "@/lib/dates";
import type { Permission } from "@/lib/auth/permissions";
import { assertPermission, ForbiddenError, type CurrentUser } from "@/lib/auth/session";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export class UserError extends Error {}

export interface ServiceContext<I> {
  user: CurrentUser;
  input: I;
  tx: Prisma.TransactionClient;
  today: string;
  now: Date;
}

/**
 * The one path every mutation takes: permission check → Zod validation →
 * a single transaction (the callback writes data, ActivityLog and recalculates health).
 */
export async function runService<S extends z.ZodType, T>(
  permission: Permission,
  schema: S,
  raw: unknown,
  fn: (ctx: ServiceContext<z.infer<S>>) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const user = await assertPermission(permission);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors = z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>;
      return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
    }
    const now = new Date();
    const data = await db.$transaction((tx) => fn({ user, input: parsed.data, tx, today: todayIso(), now }), { timeout: 20_000 });
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, error: "You don't have permission to do that." };
    if (e instanceof UserError) return { ok: false, error: e.message };
    if (typeof e === "object" && e && "code" in e && e.code === "P2002") return { ok: false, error: "That value is already in use." };
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export interface ActivityEntry {
  poId?: string | null;
  kind?: "NOTE" | "STATUS_CHANGE" | "PAYMENT" | "SYSTEM";
  text: string;
  entityType?: string;
  entityId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  actorLabel?: string;
}

export function logActivity(tx: Prisma.TransactionClient, user: CurrentUser, e: ActivityEntry) {
  return tx.activityLog.create({
    data: {
      poId: e.poId ?? null,
      userId: user.id,
      actorLabel: e.actorLabel ?? user.name,
      kind: e.kind ?? "STATUS_CHANGE",
      text: e.text,
      entityType: e.entityType,
      entityId: e.entityId,
      before: e.before,
      after: e.after,
    },
  });
}

/** FormData → plain object (repeated keys become arrays). */
export function formToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (v instanceof File) continue;
    if (k in out) out[k] = ([] as unknown[]).concat(out[k], v);
    else out[k] = v;
  }
  return out;
}

/** Keep only the fields that changed, for before/after logging. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const k of Object.keys(after)) {
    const x = before[k];
    const y = after[k];
    const xs = x instanceof Date ? x.toISOString() : x != null && typeof x === "object" && "toNumber" in x ? String(x) : x;
    const ys = y instanceof Date ? y.toISOString() : y != null && typeof y === "object" && "toNumber" in y ? String(y) : y;
    if (String(xs ?? "") !== String(ys ?? "")) {
      b[k] = xs ?? null;
      a[k] = ys ?? null;
    }
  }
  return { before: b, after: a, changed: Object.keys(a) };
}
