import { buildTree, type RecipeLine, type SubproductRecipe, type TreeNode } from "@/lib/recipes/tree";

export type DemandProduction = {
  date: string;
  scheduleItemId: string;
  name: string;
  /** how many times the recipe is made that day ("2x Produzir" = 2) */
  batches: number;
};

export type DemandRecipe = { lines: RecipeLine[] };

export type MaterialDemand = {
  total: number;
  byDate: Map<string, number>;
};

export type DemandResult = {
  byMaterial: Map<string, MaterialDemand>;
  /** productions whose schedule item has no technical sheet to read the ingredients from */
  withoutRecipe: DemandProduction[];
  /** ingredient lines whose unit could not be converted to the raw material's unit */
  unitMismatches: { scheduleItemId: string; material: string; from: string; to: string }[];
};

/** Quantity in `to` units (kg/g, L/mL are convertible); null when the units are not compatible. */
export function convertQuantity(quantity: number, from: string, to: string): number | null {
  const a = from.trim().toLowerCase();
  const b = to.trim().toLowerCase();
  if (a === b) return quantity;
  const mass: Record<string, number> = { kg: 1, g: 0.001 };
  const volume: Record<string, number> = { l: 1, ml: 0.001 };
  if (a in mass && b in mass) return (quantity * mass[a]) / mass[b];
  if (a in volume && b in volume) return (quantity * volume[a]) / volume[b];
  return null;
}

function leaves(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((n) => (n.subproductId ? leaves(n.children) : [n]));
}

/**
 * Hortifruti demand of the productions in a period: each production multiplies the quantities of
 * its technical sheet by its batches, subproducts are opened down to their raw materials, and only
 * the raw materials of the hortifruti category are summed (per raw material and per day).
 */
export function computeDemand(args: {
  productions: DemandProduction[];
  /** technical sheet of each schedule item (undefined when it has none) */
  recipeByItem: Map<string, DemandRecipe | undefined>;
  subproducts: Record<string, SubproductRecipe | undefined>;
  /** hortifruti raw materials: id -> unit of measure */
  hortifruti: Map<string, string>;
}): DemandResult {
  const byMaterial = new Map<string, MaterialDemand>();
  const withoutRecipe: DemandProduction[] = [];
  const unitMismatches: DemandResult["unitMismatches"] = [];

  for (const production of args.productions) {
    const recipe = args.recipeByItem.get(production.scheduleItemId);
    if (!recipe || recipe.lines.length === 0) {
      withoutRecipe.push(production);
      continue;
    }
    const scaled = recipe.lines.map((l) => ({ ...l, quantity: l.quantity * production.batches }));
    for (const leaf of leaves(buildTree(scaled, args.subproducts))) {
      const materialUnit = leaf.rawMaterialId ? args.hortifruti.get(leaf.rawMaterialId) : undefined;
      if (!leaf.rawMaterialId || materialUnit === undefined) continue;
      const quantity = convertQuantity(leaf.quantity, leaf.unit, materialUnit);
      if (quantity === null) {
        unitMismatches.push({
          scheduleItemId: production.scheduleItemId,
          material: leaf.label,
          from: leaf.unit,
          to: materialUnit,
        });
        continue;
      }
      const entry = byMaterial.get(leaf.rawMaterialId) ?? { total: 0, byDate: new Map<string, number>() };
      entry.total += quantity;
      entry.byDate.set(production.date, (entry.byDate.get(production.date) ?? 0) + quantity);
      byMaterial.set(leaf.rawMaterialId, entry);
    }
  }

  return { byMaterial, withoutRecipe, unitMismatches };
}

/** Batches of a schedule label: "Produzir" = 1, "2x Produzir" = 2, anything else (prep, thaw…) = 0. */
export function batchesOfLabel(label: string): number {
  const l = label.trim().toLowerCase();
  if (!l.includes("produzir")) return 0;
  const times = /^(\d+)\s*x/.exec(l);
  return times ? Number(times[1]) : 1;
}

/** What to order: the demand minus what is in stock, never negative. */
export function quantityToOrder(needed: number, inStock: number): number {
  return Math.max(0, Math.round((needed - inStock) * 1000) / 1000);
}
