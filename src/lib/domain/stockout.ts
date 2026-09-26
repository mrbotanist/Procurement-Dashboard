// Stockout risk for incoming inventory. See CLAUDE.md → "Stockout risk".

import { addDays, daysBetween, type IsoDate } from "../dates";
import { fmtDate } from "../format";

export type StockLevel = "risk" | "warn" | "ok";

export interface StockoutResult {
  /** Whole days of stock left; null when nothing sells. */
  coverDays: number | null;
  stockoutDate: IsoDate | null;
  level: StockLevel;
  label: "Stockout risk" | "Tight" | "Covered";
  reason: string;
  /** Days the stockout comes before the ETA (positive = before). */
  gap: number | null;
}

export function stockoutRisk(stock: number, dailySalesRate: number, eta: IsoDate | null, today: IsoDate): StockoutResult {
  if (dailySalesRate <= 0) {
    return { coverDays: null, stockoutDate: null, level: "ok", label: "Covered", reason: "No recent sales", gap: null };
  }
  const coverDays = Math.floor(stock / dailySalesRate);
  const stockoutDate = addDays(today, coverDays);
  if (!eta) {
    // Nothing incoming: flag when stock runs out within two weeks.
    const level: StockLevel = coverDays < 7 ? "risk" : coverDays < 14 ? "warn" : "ok";
    return {
      coverDays,
      stockoutDate,
      level,
      label: level === "risk" ? "Stockout risk" : level === "warn" ? "Tight" : "Covered",
      reason: level === "ok" ? `Cover until ${fmtDate(stockoutDate)}` : `Stockout ~${fmtDate(stockoutDate)}, nothing incoming`,
      gap: null,
    };
  }
  const gap = daysBetween(stockoutDate, eta);
  if (gap > 0) {
    return { coverDays, stockoutDate, level: "risk", label: "Stockout risk", reason: `Stockout ~${fmtDate(stockoutDate)}, ${gap} ${gap === 1 ? "day" : "days"} before arrival`, gap };
  }
  if (gap > -3) {
    return { coverDays, stockoutDate, level: "warn", label: "Tight", reason: `Tight: cover ends ${fmtDate(stockoutDate)}`, gap };
  }
  return { coverDays, stockoutDate, level: "ok", label: "Covered", reason: "Covered until arrival", gap };
}
