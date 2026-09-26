// Enum → display label + tone. The single place that maps statuses to colors.

import type {
  CustomsStatus,
  Health,
  InventoryStatus,
  PaymentStatus,
  PoStatus,
  ProductionStatus,
  Role,
  ShipmentStatus,
} from "@/generated/prisma/enums";

export type Tone = "green" | "orange" | "red" | "blue" | "gray";

export const PO_STATUS_LABEL: Record<PoStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  CONFIRMED: "Confirmed",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
};

export const PRODUCTION_STATUS_LABEL: Record<ProductionStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PRODUCTION: "In Production",
  READY: "Ready",
  DELAYED: "Delayed",
  COMPLETED: "Completed",
};

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  NOT_SHIPPED: "Not Shipped",
  READY_TO_SHIP: "Ready to Ship",
  SHIPPED: "Shipped",
  IN_TRANSIT: "In Transit",
  DELIVERED: "Delivered",
};

export const CUSTOMS_STATUS_LABEL: Record<CustomsStatus, string> = {
  NOT_STARTED: "Not Started",
  DOCUMENTS_REQUIRED: "Documents Required",
  IN_CLEARANCE: "In Clearance",
  CLEARED: "Cleared",
  ON_HOLD: "On Hold",
};

export const INVENTORY_STATUS_LABEL: Record<InventoryStatus, string> = {
  NOT_RECEIVED: "Not Received",
  PARTIALLY_RECEIVED: "Partially Received",
  RECEIVED: "Received",
  STOCKED: "Stocked",
};

export const HEALTH_LABEL: Record<Health, string> = {
  ON_TRACK: "On Track",
  NEEDS_ATTENTION: "Needs Attention",
  DELAYED: "Delayed",
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  PROCUREMENT_MANAGER: "Procurement Manager",
  FINANCE: "Finance",
  WAREHOUSE: "Warehouse",
  MANAGEMENT: "Management",
};

// Mirrors TONE in design/prototype/fpv-data-v2.js.
const TONE_BY_LABEL: Record<string, Tone> = {
  Paid: "green",
  "Partially Paid": "blue",
  Pending: "orange",
  Overdue: "red",
  "Not Started": "gray",
  "In Production": "blue",
  Ready: "green",
  Delayed: "red",
  Completed: "green",
  "Not Shipped": "gray",
  "Ready to Ship": "blue",
  Shipped: "blue",
  "In Transit": "blue",
  Delivered: "green",
  "Documents Required": "orange",
  "In Clearance": "blue",
  Cleared: "green",
  "On Hold": "red",
  "Not Received": "gray",
  "Partially Received": "blue",
  Received: "green",
  Stocked: "green",
  "On Track": "green",
  "Needs Attention": "orange",
  Draft: "gray",
  Sent: "orange",
  Confirmed: "green",
  Closed: "gray",
  Cancelled: "gray",
};

export function toneFor(label: string): Tone {
  return TONE_BY_LABEL[label] ?? "gray";
}
