"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/get-session";
import { createAdminClient } from "@/lib/supabase/admin";

const SECTORS = ["Pães", "Salgados", "Folheados", "Cozinha"] as const;

const itemSchema = z.object({
  product_code: z.string().trim().min(1, "Informe o código.").max(30),
  display_name: z.string().trim().min(1, "Informe o nome.").max(120),
  sector: z.enum(SECTORS).nullable(),
  group_name: z.string().trim().max(80).nullable(),
  unit_measure: z.enum(["UNID", "KG"]).nullable(),
  unit_weight_kg: z.number().positive("O peso deve ser maior que zero.").max(1000).nullable(),
  active: z.boolean(),
});

export type CatalogInput = z.input<typeof itemSchema>;
export type CatalogResult = { ok: true } | { ok: false; error: string };

function clean(input: CatalogInput) {
  return { ...input, group_name: input.group_name?.trim() ? input.group_name.trim() : null };
}

/** Cria ou atualiza um item do catálogo (a chave é o código do produto no ERP). */
export async function saveCatalogItem(input: CatalogInput): Promise<CatalogResult> {
  await requireAdmin();
  const parsed = itemSchema.safeParse(clean(input));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const { error } = await createAdminClient().from("erp_product_catalog").upsert(parsed.data, { onConflict: "product_code" });
  if (error) return { ok: false, error: "Não foi possível salvar." };

  revalidatePath("/cadastro-produtos-erp");
  return { ok: true };
}

/** Cadastra vários códigos de uma vez (os que já existem no catálogo não são alterados). */
export async function registerPendingItems(inputs: CatalogInput[]): Promise<CatalogResult & { created?: number }> {
  await requireAdmin();
  const parsed = z.array(itemSchema).max(500).safeParse(inputs.map(clean));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (parsed.data.length === 0) return { ok: true, created: 0 };

  const { error } = await createAdminClient()
    .from("erp_product_catalog")
    .upsert(parsed.data, { onConflict: "product_code", ignoreDuplicates: true });
  if (error) return { ok: false, error: "Não foi possível cadastrar." };

  revalidatePath("/cadastro-produtos-erp");
  return { ok: true, created: parsed.data.length };
}
