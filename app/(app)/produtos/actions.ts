"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { productSchema } from "@/lib/validations/product";
import { z } from "zod";

export type FormState = { error?: string } | undefined;

type OtherKind = "subproduct" | "raw_material";

const otherKindSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome"),
  unit: z.string().trim().min(1, "Informe a unidade").default("und"),
  sku: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
});

/** "NOME" -> "SP NOME" (or "MP NOME"); a name that already starts with the prefix is left alone. */
function withPrefix(name: string, kind: OtherKind): string {
  const prefix = kind === "subproduct" ? "SP" : "MP";
  const trimmed = name.trim();
  return new RegExp(`^${prefix}\\s`, "i").test(trimmed) ? trimmed : `${prefix} ${trimmed}`;
}

function otherKindFields(formData: FormData) {
  return otherKindSchema.safeParse({
    name: formData.get("name"),
    unit: formData.get("unit"),
    sku: formData.get("sku") || undefined,
  });
}

/** Registers a subproduct or raw material (instead of a product); returns its id. */
async function createOtherKind(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kind: OtherKind,
  fields: z.infer<typeof otherKindSchema>,
  userId: string
): Promise<{ id?: string; error?: string }> {
  const name = withPrefix(fields.name, kind);
  if (kind === "subproduct") {
    const { data, error } = await supabase
      .from("subproducts")
      .insert({ name, unit: fields.unit, created_by: userId })
      .select("id")
      .single();
    if (error || !data) {
      return { error: error?.code === "23505" ? `Já existe um subproduto chamado "${name}".` : "Não foi possível cadastrar o subproduto." };
    }
    return { id: data.id as string };
  }
  const { data, error } = await supabase
    .from("raw_materials")
    .insert({ name, unit: fields.unit, code: fields.sku, created_by: userId })
    .select("id")
    .single();
  if (error || !data) {
    return { error: error?.code === "23505" ? `Já existe uma matéria-prima chamada "${name}".` : "Não foi possível cadastrar a matéria-prima." };
  }
  return { id: data.id as string };
}

function revalidateProductAreas() {
  for (const path of [
    "/produtos",
    "/produtos/subprodutos",
    "/produtos/materias-primas",
    "/produtos/fichas",
    "/estoque",
  ]) {
    revalidatePath(path);
  }
}

export async function createProduct(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await requireUser();

  const kind = String(formData.get("kind") ?? "product");
  if (kind === "subproduct" || kind === "raw_material") {
    const fields = otherKindFields(formData);
    if (!fields.success) return { error: fields.error.issues[0]?.message ?? "Dados inválidos" };
    const created = await createOtherKind(await createClient(), kind, fields.data, userId);
    if (created.error) return { error: created.error };
    revalidateProductAreas();
    redirect(kind === "subproduct" ? "/produtos/subprodutos" : "/produtos/materias-primas");
  }

  const parsed = productSchema.safeParse({
    sector_id: formData.get("sector_id"),
    name: formData.get("name"),
    sku: formData.get("sku"),
    unit: formData.get("unit"),
    min_quantity: formData.get("min_quantity"),
    units_per_box: formData.get("units_per_box") || undefined,
    current_quantity: formData.get("current_quantity"),
    production_group: formData.get("production_group"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({
    ...parsed.data,
    current_quantity: parsed.data.current_quantity ?? 0,
    created_by: userId,
  });

  if (error) {
    return { error: "Não foi possível criar o produto. Verifique se você tem acesso a este setor." };
  }

  revalidatePath("/produtos");
  redirect("/produtos");
}

/**
 * Reclassifies a product registered by mistake as a subproduct or raw material. The product leaves
 * the products list (it is kept, inactive and marked as converted, so counts and orders keep their
 * history), its technical sheet goes with it when it becomes a subproduct, and the stores stop
 * being asked for it.
 */
async function convertProduct(id: string, kind: OtherKind, formData: FormData, userId: string): Promise<FormState> {
  const fields = otherKindFields(formData);
  if (!fields.success) return { error: fields.error.issues[0]?.message ?? "Dados inválidos" };

  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("id, converted_to").eq("id", id).maybeSingle();
  if (!product) return { error: "Produto não encontrado." };
  if (product.converted_to) return { error: "Este item já foi convertido." };

  const { data: recipe } = await supabase.from("recipes").select("id").eq("product_id", id).maybeSingle();
  if (kind === "raw_material" && recipe) {
    const { count } = await supabase
      .from("recipe_items")
      .select("id", { count: "exact", head: true })
      .eq("recipe_id", recipe.id);
    if (count) {
      return { error: "Este item tem ficha técnica com ingredientes. Remova a ficha antes de transformá-lo em matéria-prima." };
    }
  }

  const created = await createOtherKind(supabase, kind, fields.data, userId);
  if (created.error || !created.id) return { error: created.error ?? "Não foi possível converter." };

  if (recipe) {
    const { error: recipeError } =
      kind === "subproduct"
        ? await supabase.from("recipes").update({ product_id: null, subproduct_id: created.id }).eq("id", recipe.id)
        : await supabase.from("recipes").delete().eq("id", recipe.id);
    if (recipeError) return { error: "Não foi possível mover a ficha técnica. Nada foi convertido." };
  }

  const { error } = await supabase
    .from("products")
    .update({ active: false, converted_to: kind, converted_id: created.id })
    .eq("id", id);
  if (error) return { error: "Não foi possível concluir a conversão. Verifique se você tem acesso ao setor." };

  // the stores' form and the automatic orders read these minimums: it must not be asked for any more
  await createAdminClient().from("store_product_mins").delete().eq("product_id", id);

  revalidateProductAreas();
  redirect(kind === "subproduct" ? "/produtos/subprodutos" : "/produtos/materias-primas");
}

export async function updateProduct(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await requireUser();
  const id = String(formData.get("id"));

  const kind = String(formData.get("kind") ?? "product");
  if (kind === "subproduct" || kind === "raw_material") return convertProduct(id, kind, formData, userId);

  const parsed = productSchema.safeParse({
    sector_id: formData.get("sector_id"),
    name: formData.get("name"),
    sku: formData.get("sku"),
    unit: formData.get("unit"),
    min_quantity: formData.get("min_quantity"),
    units_per_box: formData.get("units_per_box") || undefined,
    production_group: formData.get("production_group"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({
      sector_id: parsed.data.sector_id,
      name: parsed.data.name,
      sku: parsed.data.sku ?? null,
      unit: parsed.data.unit,
      min_quantity: parsed.data.min_quantity,
      units_per_box: parsed.data.units_per_box,
      production_group: parsed.data.production_group,
    })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível salvar as alterações." };
  }

  revalidatePath("/produtos");
  redirect("/produtos");
}

export async function toggleProductActive(id: string, active: boolean) {
  await requireUser();
  const supabase = await createClient();
  await supabase.from("products").update({ active }).eq("id", id);
  revalidatePath("/produtos");
}
