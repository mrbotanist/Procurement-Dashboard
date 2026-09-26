import type { IsoDate } from "./dates";

export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Num = number | { toNumber(): number };
const n = (v: Num) => (typeof v === "number" ? v : v.toNumber());

/** "$1,234" or "$2.45" — cents only when present. */
export function usd(v: Num): string {
  const x = n(v);
  return "$" + x.toLocaleString("en-US", { minimumFractionDigits: x % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

/** Rounded to whole dollars. */
export function usdR(v: Num): string {
  return "$" + Math.round(n(v)).toLocaleString("en-US");
}

/** "$496K" / "$1.25M". */
export function usdK(v: Num): string {
  const x = n(v);
  return x >= 1e6 ? "$" + (x / 1e6).toFixed(2) + "M" : "$" + Math.round(x / 1e3) + "K";
}

/** "Sep 28". */
export function fmtDate(s: IsoDate | null | undefined, empty = "—"): string {
  if (!s) return empty;
  const [, m, d] = s.split("-").map(Number);
  return MON[m - 1] + " " + d;
}

/** "September 18, 2026". */
export function fmtDateLong(s: IsoDate): string {
  const [y, m, d] = s.split("-").map(Number);
  return `${MONL[m - 1]} ${d}, ${y}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
