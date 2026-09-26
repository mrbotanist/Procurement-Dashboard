// Brand budgets. See CLAUDE.md → "Budget".

import type { PoStatus, ShipmentStatus } from "@/generated/prisma/enums";

export interface BudgetFigures {
  budget: number;
  purchased: number;
  committed: number;
}

export interface BudgetSummary extends BudgetFigures {
  available: number;
  /** purchased / budget, 0–1+ */
  utilization: number;
  /** (purchased + committed) / budget > 95% */
  hot: boolean;
}

export function budgetSummary({ budget, purchased, committed }: BudgetFigures): BudgetSummary {
  const available = budget - purchased - committed;
  return {
    budget,
    purchased,
    committed,
    available,
    utilization: budget > 0 ? purchased / budget : 0,
    hot: budget > 0 ? (purchased + committed) / budget > 0.95 : purchased + committed > 0,
  };
}

/**
 * How a PO counts against its brand budget.
 * - purchased: invoiced, i.e. the supplier has shipped (commercial invoice issued) or the PO is closed
 * - committed: sent/confirmed but not yet invoiced
 * - none: drafts and cancelled POs
 */
export function budgetBucket(po: { poStatus: PoStatus; shipmentStatus: ShipmentStatus }): "purchased" | "committed" | "none" {
  if (po.poStatus === "DRAFT" || po.poStatus === "CANCELLED") return "none";
  if (po.poStatus === "CLOSED") return "purchased";
  if (po.shipmentStatus === "SHIPPED" || po.shipmentStatus === "IN_TRANSIT" || po.shipmentStatus === "DELIVERED") return "purchased";
  return "committed";
}

/** Create PO review: does this new PO fit within the brand's available budget? */
export function budgetCheck(summary: BudgetSummary | null, newPoValue: number) {
  if (!summary) return { hasBudget: false, fits: true, availableAfter: null as number | null };
  const availableAfter = summary.available - newPoValue;
  return { hasBudget: true, fits: availableAfter >= 0, availableAfter };
}
