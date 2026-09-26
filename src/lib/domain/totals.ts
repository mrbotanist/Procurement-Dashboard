// PO total = Σ qty × unitPrice × (1 − discount%) × (1 + tax%).

export interface LineInput {
  qty: number;
  unitPrice: number;
  /** Percent, e.g. 5 for 5%. */
  discountPct?: number;
  /** Percent, e.g. 5 for 5%. */
  taxPct?: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function lineTotal({ qty, unitPrice, discountPct = 0, taxPct = 0 }: LineInput): number {
  return round2(qty * unitPrice * (1 - discountPct / 100) * (1 + taxPct / 100));
}

export function poTotal(lines: LineInput[]): number {
  return round2(lines.reduce((sum, l) => sum + lineTotal(l), 0));
}

export function poUnits(lines: { qty: number }[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}
