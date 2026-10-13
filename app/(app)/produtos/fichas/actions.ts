"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { loadSubproducts } from "@/lib/recipes/load";
import { wouldCreateCycle, type RecipeLine } from "@/lib/recipes/tree";
import { createSubproductSchema, renameSubproductSchema, saveRecipeSchema } from "@/lib/validations/recipe";

export type RecipeResult = { error?: string; ok?: boolean; id?: string };

const NO_ACCESS = "Não foi possível salvar. Verifique se você tem permissão para editar fichas técnicas.";

function refresh() {
  for (const path of ["/produtos/fichas", "/produtos/subprodutos", "/produtos/materias-primas"]) revalidatePath(path);
}

/** Replaces the whole recipe (yield, method and lines) of a product or a subproduct. */
export async function saveRecipe(input: unknown): Promise<RecipeResult> {
  const { userId } = await requireUser();
  const parsed = saveRecipeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { product_id, subproduct_id, yield_quantity, yield_unit, instructions, items } = parsed.data;

  const supabase = await createClient();

  // packaging items do not have a technical sheet
  if (product_id) {
    const { data: product } = await supabase.from("products").select("sectors(name)").eq("id", product_id).single();
    if (!product) return { error: "Produto não encontrado." };
    const sector = (product as unknown as { sectors: { name: string } | null }).sectors?.name;
    if (sector && /embalage/i.test(sector)) return { error: "Embalagens não têm ficha técnica." };
  }

  // a subproduct cannot contain itself, directly or through another one
  if (subproduct_id) {
    const { recipes } = await loadSubproducts(supabase);
    const lines: RecipeLine[] = items.map((i) => ({
      name: i.name,
      subproductId: i.subproduct_id,
      rawMaterialId: i.raw_material_id,
      quantity: i.quantity,
      unit: i.unit,
    }));
    if (wouldCreateCycle(subproduct_id, lines, recipes)) {
      return { error: "Um subproduto não pode conter ele mesmo (nem por outro subproduto)." };
    }
  }

  const ownerColumn = product_id ? "product_id" : "subproduct_id";
  const ownerId = (product_id ?? subproduct_id) as string;
  const { data: existing } = await supabase.from("recipes").select("id").eq(ownerColumn, ownerId).maybeSingle();

  const fields = {
    yield_quantity,
    yield_unit,
    instructions,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
  let recipeId = existing?.id as string | undefined;
  if (recipeId) {
    const { error } = await supabase.from("recipes").update(fields).eq("id", recipeId);
    if (error) return { error: NO_ACCESS };
  } else {
    const { data: created, error } = await supabase
      .from("recipes")
      .insert({ ...fields, product_id, subproduct_id })
      .select("id")
      .single();
    if (error || !created) return { error: NO_ACCESS };
    recipeId = created.id as string;
  }

  const { error: delError } = await supabase.from("recipe_items").delete().eq("recipe_id", recipeId);
  if (delError) return { error: NO_ACCESS };
  if (items.length > 0) {
    const { error: insError } = await supabase.from("recipe_items").insert(
      items.map((i, position) => ({
        recipe_id: recipeId,
        position,
        ingredient_name: i.subproduct_id || i.raw_material_id ? null : i.name,
        subproduct_id: i.subproduct_id,
        raw_material_id: i.raw_material_id,
        quantity: i.quantity,
        unit: i.unit,
      }))
    );
    if (insError) return { error: NO_ACCESS };
  }

  refresh();
  return { ok: true };
}

export async function createSubproduct(input: unknown): Promise<RecipeResult> {
  const { userId } = await requireUser();
  const parsed = createSubproductSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subproducts")
    .insert({ name: parsed.data.name, unit: parsed.data.unit, created_by: userId })
    .select("id")
    .single();
  if (error || !data) {
    return { error: error?.code === "23505" ? "Já existe um subproduto com esse nome." : NO_ACCESS };
  }
  refresh();
  return { ok: true, id: data.id as string };
}

export async function renameSubproduct(input: unknown): Promise<RecipeResult> {
  await requireUser();
  const parsed = renameSubproductSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("subproducts")
    .update({ name: parsed.data.name, unit: parsed.data.unit })
    .eq("id", parsed.data.id);
  if (error) return { error: error.code === "23505" ? "Já existe um subproduto com esse nome." : NO_ACCESS };
  refresh();
  return { ok: true };
}

/** Deletes a subproduct that is not used by any recipe. */
export async function deleteSubproduct(id: string): Promise<RecipeResult> {
  await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Subproduto inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("subproducts").delete().eq("id", id);
  if (error) {
    return {
      error:
        error.code === "23503"
          ? "Este subproduto é usado em uma ficha técnica. Tire-o das fichas antes de excluir."
          : NO_ACCESS,
    };
  }
  refresh();
  return { ok: true };
}
