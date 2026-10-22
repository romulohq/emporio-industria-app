"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fortalezaDateISO } from "@/lib/dates";

export type CountSubmitState = { error?: string; success?: boolean; saved?: number } | undefined;

/** Public (token) hortifruti count: saves today's quantities for every raw material filled in. */
export async function submitHortifrutiCount(
  token: string,
  _prev: CountSubmitState,
  formData: FormData
): Promise<CountSubmitState> {
  const admin = createAdminClient();

  const { data: setting } = await admin.from("app_settings").select("value").eq("key", "hortifruti_count_token").maybeSingle();
  if (!setting || setting.value !== token) return { error: "Link inválido. Peça um novo link ao administrador." };

  const { data: materials } = await admin
    .from("raw_materials")
    .select("id")
    .eq("category", "hortifruti")
    .eq("active", true);
  const allowed = new Set((materials ?? []).map((m) => m.id as string));

  const today = fortalezaDateISO();
  const rows: { count_date: string; raw_material_id: string; quantity: number; updated_at: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("qty_")) continue;
    const id = key.slice(4);
    const text = String(value).trim().replace(",", ".");
    if (!allowed.has(id) || text === "") continue;
    const quantity = Number(text);
    if (!Number.isFinite(quantity) || quantity < 0 || quantity > 1_000_000) continue;
    rows.push({ count_date: today, raw_material_id: id, quantity, updated_at: new Date().toISOString() });
  }
  if (rows.length === 0) return { error: "Informe ao menos uma quantidade." };

  const { error } = await admin.from("hortifruti_counts").upsert(rows, { onConflict: "count_date,raw_material_id" });
  if (error) return { error: "Não foi possível enviar a contagem. Tente novamente." };

  revalidatePath("/compras/hortifrut");
  revalidatePath("/compras/hortifrut/solicitacao");
  return { success: true, saved: rows.length };
}
