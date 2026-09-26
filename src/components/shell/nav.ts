import type { Permission } from "@/lib/auth/permissions";

export type Counter = "notifications" | "reorder";

export interface NavLink {
  label: string;
  href: string;
  permission: Permission;
  counter?: Counter;
}

export interface NavGroup {
  label: string;
  /** A group with `href` is a single top-level link; otherwise it has items. */
  href?: string;
  permission?: Permission;
  items?: NavLink[];
}

// Mirrors NAV in design/prototype/index.html.
export const NAV: NavGroup[] = [
  { label: "Dashboard", href: "/", permission: "view:dashboard" },
  {
    label: "Procurement",
    items: [
      { label: "All Purchase Orders", href: "/orders", permission: "view:orders" },
      { label: "Pending Actions", href: "/actions", permission: "view:actions", counter: "notifications" },
      { label: "Incoming Shipments", href: "/shipments", permission: "view:shipments" },
      { label: "Purchase Calendar", href: "/calendar", permission: "view:calendar" },
    ],
  },
  {
    label: "Suppliers",
    items: [
      { label: "All Suppliers", href: "/suppliers", permission: "view:suppliers" },
      { label: "Supplier Performance", href: "/suppliers?tab=performance", permission: "view:suppliers" },
    ],
  },
  {
    label: "Brands",
    items: [
      { label: "Brand Budgets", href: "/budgets", permission: "view:budgets" },
      { label: "Purchase History", href: "/budgets?tab=history", permission: "view:budgets" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { label: "Current Stock", href: "/inventory", permission: "view:inventory" },
      { label: "Incoming Stock", href: "/inventory?tab=incoming", permission: "view:inventory" },
      { label: "Reorder Alerts", href: "/inventory?tab=reorder", permission: "view:inventory", counter: "reorder" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { label: "Procurement Spend", href: "/analytics", permission: "view:analytics" },
      { label: "Brand Analysis", href: "/analytics?tab=brands", permission: "view:analytics" },
      { label: "Product Analysis", href: "/analytics?tab=products", permission: "view:analytics" },
    ],
  },
  { label: "Documents", href: "/documents", permission: "view:documents" },
  { label: "Settings", href: "/settings", permission: "settings:manage" },
];

/**
 * Which nav href is active for the current URL. Detail pages map to their list
 * (/orders/GE-26091 → /orders); tabs are matched through the `tab` query param.
 */
export function activeHref(pathname: string, tab: string | null): string {
  const hrefs = NAV.flatMap((g) => (g.href ? [g.href] : (g.items ?? []).map((i) => i.href)));
  const withTab = tab ? hrefs.find((h) => h === `${pathname}?tab=${tab}`) : undefined;
  if (withTab) return withTab;
  if (pathname === "/") return "/";
  const base = hrefs
    .filter((h) => !h.includes("?") && h !== "/" && (pathname === h || pathname.startsWith(h + "/")))
    .sort((a, b) => b.length - a.length)[0];
  return base ?? pathname;
}
