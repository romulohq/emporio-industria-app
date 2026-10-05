export type CoverageLevel = "ok" | "warn" | "low" | "none";

export type Coverage = {
  /** stock / minimum, as a ratio (1 = exactly at the minimum); null when no minimum is set */
  ratio: number | null;
  level: CoverageLevel;
  /** units missing to reach the minimum (never negative) */
  missing: number;
};

/** Cold-storage coverage like the sheet's "Abastecimento" bar: stock in units against the minimum. */
export function coverageOf(stockUnits: number, minUnits: number): Coverage {
  const missing = Math.max(0, Math.round((minUnits - stockUnits) * 1000) / 1000);
  if (!(minUnits > 0)) return { ratio: null, level: "none", missing };
  const ratio = stockUnits / minUnits;
  const level = ratio >= 1 ? "ok" : ratio >= 0.5 ? "warn" : "low";
  return { ratio, level, missing };
}

export function stockUnits(boxes: number, unitsPerBox: number): number {
  return Math.round(boxes * unitsPerBox * 1000) / 1000;
}
