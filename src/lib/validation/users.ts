import { z } from "zod";

export const ROLES = ["ADMIN", "PROCUREMENT_MANAGER", "FINANCE", "WAREHOUSE", "MANAGEMENT"] as const;
const password = z.string().min(10, "At least 10 characters").max(200);

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Required").max(120),
  email: z.email("Enter a valid email").transform((e) => e.toLowerCase().trim()),
  role: z.enum(ROLES),
  password,
});

export const updateUserSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(1, "Required").max(120),
  role: z.enum(ROLES),
  active: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  password: z.preprocess((v) => (v === "" ? undefined : v), password.optional()),
});

export const changePasswordSchema = z
  .object({ current: z.string().min(1, "Required"), password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });
