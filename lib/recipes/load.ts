import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { RawMaterial, Recipe, RecipeItem, Subproduct } from "@/lib/types/database.types";
import type { RecipeLine, SubproductRecipe } from "@/lib/recipes/tree";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** A recipe line, with the raw material's registered name filled in. */
export const toLine = (i: RecipeItem, rawNames: Map<string, string>): RecipeLine => ({
  name: i.raw_material_id ? (rawNames.get(i.raw_material_id) ?? "Matéria-prima") : i.ingredient_name,
  subproductId: i.subproduct_id,
  rawMaterialId: i.raw_material_id,
  quantity: Number(i.quantity),
  unit: i.unit,
});

export async function loadRawMaterials(supabase: Supabase): Promise<RawMaterial[]> {
  const { data } = await supabase.from("raw_materials").select("*").order("name");
  return (data ?? []) as RawMaterial[];
}

/** Every subproduct with its own recipe, keyed by id — what the tree needs to expand any line. */
export async function loadSubproducts(supabase: Supabase): Promise<{
  list: Subproduct[];
  recipes: Record<string, SubproductRecipe>;
}> {
  const [{ data: sps }, { data: recipes }, rawMaterials] = await Promise.all([
    supabase.from("subproducts").select("*").order("name"),
    supabase.from("recipes").select("*").not("subproduct_id", "is", null),
    loadRawMaterials(supabase),
  ]);
  const rawNames = new Map(rawMaterials.map((m) => [m.id, m.name]));
  const list = (sps ?? []) as Subproduct[];
  const recipeRows = (recipes ?? []) as Recipe[];
  const { data: items } = recipeRows.length
    ? await supabase.from("recipe_items").select("*").in("recipe_id", recipeRows.map((r) => r.id)).order("position")
    : { data: [] as RecipeItem[] };
  const itemsByRecipe = new Map<string, RecipeItem[]>();
  for (const i of (items ?? []) as RecipeItem[]) {
    itemsByRecipe.set(i.recipe_id, [...(itemsByRecipe.get(i.recipe_id) ?? []), i]);
  }
  const recipeBySp = new Map(recipeRows.map((r) => [r.subproduct_id as string, r]));

  const out: Record<string, SubproductRecipe> = {};
  for (const sp of list) {
    const r = recipeBySp.get(sp.id);
    out[sp.id] = {
      name: sp.name,
      yieldQuantity: r?.yield_quantity != null ? Number(r.yield_quantity) : null,
      yieldUnit: r?.yield_unit ?? "",
      lines: r ? (itemsByRecipe.get(r.id) ?? []).map((i) => toLine(i, rawNames)) : [],
    };
  }
  return { list, recipes: out };
}

/** The recipe of a product or subproduct (null when none was written yet), with its lines in order. */
export async function loadRecipe(
  supabase: Supabase,
  owner: { productId: string } | { subproductId: string }
): Promise<{ recipe: Recipe | null; lines: RecipeLine[] }> {
  const column = "productId" in owner ? "product_id" : "subproduct_id";
  const ownerId = "productId" in owner ? owner.productId : owner.subproductId;
  const { data } = await supabase.from("recipes").select("*").eq(column, ownerId).maybeSingle();
  const recipe = (data as Recipe | null) ?? null;
  if (!recipe) return { recipe: null, lines: [] };
  const [{ data: items }, rawMaterials] = await Promise.all([
    supabase.from("recipe_items").select("*").eq("recipe_id", recipe.id).order("position"),
    loadRawMaterials(supabase),
  ]);
  const rawNames = new Map(rawMaterials.map((m) => [m.id, m.name]));
  return { recipe, lines: ((items ?? []) as RecipeItem[]).map((i) => toLine(i, rawNames)) };
}
