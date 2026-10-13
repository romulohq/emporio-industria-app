"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { rawMaterialSchema, updateRawMaterialSchema } from "@/lib/validations/recipe";

export type RawMaterialResult = { error?: string; ok?: boolean };

const NO_ACCESS = "Não foi possível salvar. Verifique se você tem permissão para editar matérias-primas.";

function refresh() {
  for (const path of ["/produtos/materias-primas", "/produtos/fichas", "/produtos/subprodutos"]) revalidatePath(path);
}

export async function createRawMaterial(input: unknown): Promise<RawMaterialResult> {
  const { userId } = await requireUser();
  const parsed = rawMaterialSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.from("raw_materials").insert({ ...parsed.data, created_by: userId });
  if (error) return { error: error.code === "23505" ? "Já existe uma matéria-prima com esse nome." : NO_ACCESS };
  refresh();
  return { ok: true };
}

export async function updateRawMaterial(input: unknown): Promise<RawMaterialResult> {
  await requireUser();
  const parsed = updateRawMaterialSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { id, ...fields } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("raw_materials").update(fields).eq("id", id);
  if (error) return { error: error.code === "23505" ? "Já existe uma matéria-prima com esse nome." : NO_ACCESS };
  refresh();
  return { ok: true };
}

/** Deletes a raw material that is not used in any technical sheet. */
export async function deleteRawMaterial(id: string): Promise<RawMaterialResult> {
  await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Matéria-prima inválida." };

  const supabase = await createClient();
  const { error } = await supabase.from("raw_materials").delete().eq("id", id);
  if (error) {
    return {
      error:
        error.code === "23503"
          ? "Esta matéria-prima é usada em fichas técnicas. Tire-a das fichas antes de excluir."
          : NO_ACCESS,
    };
  }
  refresh();
  return { ok: true };
}
