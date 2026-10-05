"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-session";
import { productSchema } from "@/lib/validations/product";

export type FormState = { error?: string } | undefined;

export async function createProduct(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await requireUser();

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

export async function updateProduct(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const id = String(formData.get("id"));

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
