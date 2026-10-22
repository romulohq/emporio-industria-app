/** One ingredient line of a recipe: a raw material (rawMaterialId, name filled in), a subproduct (subproductId) or a loose input (name only). */
export type RecipeLine = {
  name: string | null;
  subproductId: string | null;
  rawMaterialId?: string | null;
  quantity: number;
  unit: string;
};

export type SubproductRecipe = {
  name: string;
  yieldQuantity: number | null;
  yieldUnit: string;
  lines: RecipeLine[];
};

export type TreeNode = {
  label: string;
  /** set on a leaf that is a registered raw material */
  rawMaterialId?: string | null;
  quantity: number;
  unit: string;
  subproductId: string | null;
  /** the subproduct's own recipe, scaled to the quantity used here */
  children: TreeNode[];
  /** subproduct has no recipe registered yet */
  noRecipe?: boolean;
  /** the subproduct appears inside itself — expansion stops here */
  cycle?: boolean;
  /** the recipe could not be scaled (its yield unit differs from the unit used) — shown as written */
  unscaled?: boolean;
};

const sameUnit = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Expands recipe lines into a tree: every subproduct line shows its own recipe underneath.
 * A subproduct used at 5 kg whose recipe yields 10 kg is shown with half of each ingredient.
 */
export function buildTree(
  lines: RecipeLine[],
  subproducts: Record<string, SubproductRecipe | undefined>,
  trail: string[] = []
): TreeNode[] {
  return lines.map((line) => {
    if (!line.subproductId) {
      return {
        label: line.name ?? "",
        rawMaterialId: line.rawMaterialId ?? null,
        quantity: line.quantity,
        unit: line.unit,
        subproductId: null,
        children: [],
      };
    }
    const sp = subproducts[line.subproductId];
    const base = {
      label: sp?.name ?? "Subproduto",
      quantity: line.quantity,
      unit: line.unit,
      subproductId: line.subproductId,
    };
    if (trail.includes(line.subproductId)) return { ...base, children: [], cycle: true };
    if (!sp || sp.lines.length === 0) return { ...base, children: [], noRecipe: true };

    const canScale = sp.yieldQuantity !== null && sp.yieldQuantity > 0 && sameUnit(sp.yieldUnit, line.unit);
    const factor = canScale ? line.quantity / (sp.yieldQuantity as number) : 1;
    const scaled = sp.lines.map((l) => ({ ...l, quantity: l.quantity * factor }));
    return {
      ...base,
      children: buildTree(scaled, subproducts, [...trail, line.subproductId]),
      unscaled: !canScale,
    };
  });
}

/** True when putting `lines` in the recipe of subproduct `ownerId` would make it contain itself. */
export function wouldCreateCycle(
  ownerId: string,
  lines: RecipeLine[],
  subproducts: Record<string, SubproductRecipe | undefined>
): boolean {
  const seen = new Set<string>();
  const stack = lines.map((l) => l.subproductId).filter((id): id is string => !!id);
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (id === ownerId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const l of subproducts[id]?.lines ?? []) if (l.subproductId) stack.push(l.subproductId);
  }
  return false;
}
