export type UnitOption = { value: string; label: string };

/** Units of measure offered for a product. */
export const STANDARD_UNITS: UnitOption[] = [
  { value: "und", label: "Unidade (und)" },
  { value: "kg", label: "Quilo (kg)" },
  { value: "L", label: "Litro (L)" },
];

/** Units that exist on products imported earlier (packaging); kept selectable so they are not lost. */
const LEGACY_UNITS: Record<string, string> = {
  pct: "Pacote (pct)",
  cx: "Caixa (cx)",
  fd: "Fardo (fd)",
  bobina: "Bobina",
};

/** The standard options, plus the product's current unit when it is not one of them. */
export function unitOptionsFor(current?: string | null): UnitOption[] {
  if (!current || STANDARD_UNITS.some((u) => u.value === current)) return STANDARD_UNITS;
  return [...STANDARD_UNITS, { value: current, label: LEGACY_UNITS[current] ?? current }];
}
