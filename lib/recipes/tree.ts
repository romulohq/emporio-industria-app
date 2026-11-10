/**
 * One ingredient line of a recipe: a raw material (rawMaterialId, name filled in), a subproduct (subproductId),
 * another product (productId) or a loose input (name only).
 */
export type RecipeLine = {
  name: string | null;
  subproductId: string | null;
  /** another product used as ingredient: its own technical sheet is opened underneath */
  productId?: string | null;
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
  /** set on a line that is another product */
  productId?: string | null;
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
 * Key of the recipe a line opens: the subproduct's id, or "p:<id>" for a product (null for raw materials and
 * loose inputs). The recipes map handed to buildTree holds both kinds under these keys.
 */
export const lineKey = (l: Pick<RecipeLine, "subproductId" | "productId">): string | null =>
  l.subproductId ?? (l.productId ? `p:${l.productId}` : null);

export const productKey = (productId: string) => `p:${productId}`;

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
    const key = lineKey(line);
    if (!key) {
      return {
        label: line.name ?? "",
        rawMaterialId: line.rawMaterialId ?? null,
        quantity: line.quantity,
        unit: line.unit,
        subproductId: null,
        children: [],
      };
    }
    const sp = subproducts[key];
    const base = {
      label: sp?.name ?? (line.productId ? "Produto" : "Subproduto"),
      quantity: line.quantity,
      unit: line.unit,
      subproductId: line.subproductId ?? null,
      productId: line.productId ?? null,
    };
    if (trail.includes(key)) return { ...base, children: [], cycle: true };
    if (!sp || sp.lines.length === 0) return { ...base, children: [], noRecipe: true };

    const canScale = sp.yieldQuantity !== null && sp.yieldQuantity > 0 && sameUnit(sp.yieldUnit, line.unit);
    const factor = canScale ? line.quantity / (sp.yieldQuantity as number) : 1;
    const scaled = sp.lines.map((l) => ({ ...l, quantity: l.quantity * factor }));
    return {
      ...base,
      children: buildTree(scaled, subproducts, [...trail, key]),
      unscaled: !canScale,
    };
  });
}

/**
 * True when putting `lines` in the recipe whose key is `ownerId` (a subproduct id, or "p:<product id>") would make
 * it contain itself, directly or through other subproducts and products.
 */
export function wouldCreateCycle(
  ownerId: string,
  lines: RecipeLine[],
  subproducts: Record<string, SubproductRecipe | undefined>
): boolean {
  const seen = new Set<string>();
  const stack = lines.map(lineKey).filter((id): id is string => !!id);
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (id === ownerId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const l of subproducts[id]?.lines ?? []) {
      const k = lineKey(l);
      if (k) stack.push(k);
    }
  }
  return false;
}
