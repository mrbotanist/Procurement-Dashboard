// Pipeline stage, list sorting and quick filters for purchase orders.

import type {
  CustomsStatus,
  Health,
  InventoryStatus,
  PaymentStatus,
  PoStatus,
  ProductionStatus,
  ShipmentStatus,
} from "@/generated/prisma/enums";
import { daysBetween, type IsoDate } from "../dates";

export const STAGES = [
  "Draft",
  "PO Sent",
  "Confirmed",
  "Payment Pending",
  "Paid",
  "Production",
  "Ready to Ship",
  "Shipped",
  "In Transit",
  "Customs",
  "Received",
  "Closed",
] as const;
export type Stage = (typeof STAGES)[number];

export interface StatusSet {
  poStatus: PoStatus;
  paymentStatus: PaymentStatus;
  productionStatus: ProductionStatus;
  shipmentStatus: ShipmentStatus;
  customsStatus: CustomsStatus;
  inventoryStatus: InventoryStatus;
}

/** Where a PO sits in the 12-stage pipeline (null for cancelled). */
export function poStage(s: StatusSet, nextDueDate: IsoDate | null, today: IsoDate): Stage | null {
  if (s.poStatus === "CANCELLED") return null;
  if (s.poStatus === "CLOSED") return "Closed";
  if (s.poStatus === "DRAFT") return "Draft";
  if (s.poStatus === "SENT") return "PO Sent";
  if (s.inventoryStatus !== "NOT_RECEIVED" || s.shipmentStatus === "DELIVERED") return "Received";
  if (s.customsStatus === "DOCUMENTS_REQUIRED" || s.customsStatus === "IN_CLEARANCE" || s.customsStatus === "ON_HOLD") return "Customs";
  if (s.shipmentStatus === "IN_TRANSIT") return "In Transit";
  if (s.shipmentStatus === "SHIPPED") return "Shipped";
  if (s.shipmentStatus === "READY_TO_SHIP" || s.productionStatus === "READY") return "Ready to Ship";
  if (s.productionStatus !== "NOT_STARTED") return "Production";
  // Confirmed, production not started yet.
  if (s.paymentStatus === "PAID" || s.paymentStatus === "PARTIALLY_PAID") return "Paid";
  if (s.paymentStatus === "OVERDUE" || (nextDueDate && daysBetween(today, nextDueDate) <= 7)) return "Payment Pending";
  return "Confirmed";
}

export const isOpen = (po: { poStatus: PoStatus }) => po.poStatus !== "CLOSED" && po.poStatus !== "CANCELLED";

const HEALTH_ORDER: Record<Health, number> = { DELAYED: 0, NEEDS_ATTENTION: 1, ON_TRACK: 2 };

/** Delayed, Needs Attention, On Track; then ETA ascending with no ETA last. */
export function compareByHealth(a: { health: Health; eta: IsoDate | null }, b: { health: Health; eta: IsoDate | null }): number {
  return HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health] || (a.eta ?? "9999").localeCompare(b.eta ?? "9999");
}

export const QUICK_FILTERS = [
  { key: "all", label: "All orders" },
  { key: "attention", label: "Needs attention" },
  { key: "delayed", label: "Delayed" },
  { key: "payment", label: "Payment pending" },
  { key: "unconfirmed", label: "Unconfirmed" },
  { key: "transit", label: "In transit" },
] as const;
export type QuickFilter = (typeof QUICK_FILTERS)[number]["key"];

/** Filters used by quick segments, KPI cards and action tiles. */
export type OrderFilter = QuickFilter | "production" | "customs" | "open" | "closed";

export function matchesFilter(po: StatusSet & { health: Health }, f: OrderFilter): boolean {
  switch (f) {
    case "all":
      return true;
    case "open":
      return isOpen(po);
    case "closed":
      return po.poStatus === "CLOSED";
    case "attention":
      return isOpen(po) && po.health !== "ON_TRACK";
    case "delayed":
      return po.health === "DELAYED";
    case "payment":
      return isOpen(po) && po.poStatus !== "DRAFT" && ["PENDING", "OVERDUE", "PARTIALLY_PAID"].includes(po.paymentStatus);
    case "unconfirmed":
      return po.poStatus === "SENT" || po.poStatus === "DRAFT";
    case "transit":
      return po.shipmentStatus === "SHIPPED" || po.shipmentStatus === "IN_TRANSIT";
    case "production":
      return isOpen(po) && po.shipmentStatus === "NOT_SHIPPED" && (po.productionStatus === "IN_PRODUCTION" || po.productionStatus === "DELAYED");
    case "customs":
      return po.customsStatus === "DOCUMENTS_REQUIRED";
  }
}
