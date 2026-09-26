// Supplier performance from completed orders.

import { daysBetween, type IsoDate } from "../dates";

export interface CompletedOrder {
  orderDate: IsoDate;
  /** Promised arrival. */
  eta: IsoDate | null;
  /** When the goods actually arrived. */
  arrivedAt: IsoDate;
}

export interface Performance {
  /** Average days from order to arrival, rounded. */
  leadTimeDays: number | null;
  /** Share (0–100) that arrived on or before the promised ETA. */
  onTimeRate: number | null;
  completed: number;
}

export function supplierPerformance(orders: CompletedOrder[]): Performance {
  if (orders.length === 0) return { leadTimeDays: null, onTimeRate: null, completed: 0 };
  const lead = orders.reduce((s, o) => s + daysBetween(o.orderDate, o.arrivedAt), 0) / orders.length;
  const withEta = orders.filter((o) => o.eta);
  const onTime = withEta.filter((o) => o.arrivedAt <= o.eta!).length;
  return {
    leadTimeDays: Math.round(lead),
    onTimeRate: withEta.length ? Math.round((onTime / withEta.length) * 100) : null,
    completed: orders.length,
  };
}

/** On-time below 85% is flagged red; lead time above 18 days is flagged red. */
export const ON_TIME_THRESHOLD = 85;
export const LEAD_TIME_THRESHOLD = 18;
