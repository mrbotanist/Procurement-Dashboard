// Role → permission map. See the Roles table in CLAUDE.md / design/README.md.
// Pure module: safe to import from client components (e.g. to hide nav items),
// but the server must always re-check with can()/requirePermission().

import type { Role } from "@/generated/prisma/enums";

export const PERMISSIONS = [
  // Viewing
  "view:dashboard",
  "view:orders",
  "view:shipments",
  "view:inventory",
  "view:suppliers",
  "view:budgets",
  "view:analytics",
  "view:calendar",
  "view:documents",
  "view:actions",
  // Mutations
  "po:write",
  "supplier:write",
  "product:write",
  "payment:write",
  "payment:approve",
  "shipment:write",
  "document:write",
  "note:write",
  "receiving:write",
  "stock:write",
  "budget:write",
  "notification:resolve",
  "user:manage",
  "settings:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const VIEW_ALL: Permission[] = PERMISSIONS.filter((p) => p.startsWith("view:"));

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  PROCUREMENT_MANAGER: [
    ...VIEW_ALL,
    "po:write",
    "supplier:write",
    "product:write",
    "payment:write",
    "shipment:write",
    "document:write",
    "note:write",
    "notification:resolve",
  ],
  FINANCE: [...VIEW_ALL, "payment:write", "payment:approve", "notification:resolve"],
  WAREHOUSE: [
    "view:dashboard",
    "view:orders",
    "view:shipments",
    "view:inventory",
    "view:calendar",
    "view:documents",
    "view:actions",
    "receiving:write",
    "stock:write",
  ],
  MANAGEMENT: VIEW_ALL,
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
