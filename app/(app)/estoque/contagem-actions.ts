"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { saveStockCountSchema, updateLimitsSchema, updateUnitSchema } from "@/lib/validations/stock-count";
import { stockUnits } from "@/lib/stock/coverage";

export type SaveCountState = { error?: string; saved?: number } | undefined;

/**
 * Saves a day's cold-storage count (boxes per product). Units per box come from the product, so
 * a store of history keeps the factor that was in force. The product's current balance follows
 * the most recent count only — filling in an older day never rewinds it.
 */
export async function saveStockCount(_prev: SaveCountState, formData: FormData): Promise<SaveCountState> {
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("entries") ?? "[]"));
  } catch {
    return { error: "Dados inválidos." };
  }
  return persistStockCount({ count_date: formData.get("count_date"), entries: raw }, true);
}

/**
 * Autosave: the count screen sends the boxes typed so far a moment after the last keystroke.
 * Pages are dynamic, so the other screens read the new values on their next visit without a revalidation here.
 */
export async function autosaveStockCount(input: unknown): Promise<SaveCountState> {
  return persistStockCount(input, false);
}

async function persistStockCount(input: unknown, revalidate: boolean): Promise<SaveCountState> {
  const { userId } = await requireUser();
  const parsed = saveStockCountSchema.safeParse(input);
  if (!parsed.success) return { error: "Informe ao menos uma contagem." };
  const { count_date, entries } = parsed.data;

  const supabase = await createClient();
  const productIds = entries.map((e) => e.product_id);
  const { data: products } = await supabase
    .from("products")
    .select("id, units_per_box, current_quantity")
    .in("id", productIds);
  const productById = new Map((products ?? []).map((p) => [p.id as string, p]));

  const rows = entries
    .filter((e) => productById.has(e.product_id))
    .map((e) => ({
      count_date,
      product_id: e.product_id,
      boxes: e.boxes,
      units_per_box: Number(productById.get(e.product_id)!.units_per_box),
      counted_by: userId,
    }));
  if (rows.length === 0) return { error: "Nenhum produto válido na contagem." };

  const { error } = await supabase.from("stock_counts").upsert(rows, { onConflict: "count_date,product_id" });
  if (error) {
    return { error: "Não foi possível salvar. Verifique se você tem acesso aos setores desses produtos." };
  }

  // balance follows the latest count date per product
  const { data: latest } = await supabase
    .from("stock_counts")
    .select("product_id, count_date, boxes, units_per_box")
    .in("product_id", productIds)
    .order("count_date", { ascending: false });
  const seen = new Set<string>();
  for (const c of latest ?? []) {
    const id = c.product_id as string;
    if (seen.has(id)) continue;
    seen.add(id);
    if (c.count_date !== count_date) continue;
    const balance = stockUnits(Number(c.boxes), Number(c.units_per_box));
    if (Number(productById.get(id)?.current_quantity) !== balance) {
      await supabase.from("products").update({ current_quantity: balance }).eq("id", id);
    }
  }

  if (revalidate) {
    revalidatePath("/estoque");
    revalidatePath("/estoque/mes");
  }
  return { saved: rows.length };
}

/** Changes a product's unit of measure (unit, kg or liter); counts and minimums stay as typed. */
export async function updateProductUnit(input: unknown): Promise<{ error?: string; ok?: boolean }> {
  await requireUser();
  const parsed = updateUnitSchema.safeParse(input);
  if (!parsed.success) return { error: "Medida inválida." };

  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ unit: parsed.data.unit }).eq("id", parsed.data.product_id);
  if (error) return { error: "Não foi possível alterar a medida. Verifique se você tem acesso ao setor." };

  for (const path of ["/estoque", "/estoque/mes", "/estoque/saldo", "/produtos"]) revalidatePath(path);
  return { ok: true };
}

/** Edits the minimum stock and the quantity per box of products. Past counts keep the factor they were saved with. */
export async function updateProductLimits(input: unknown): Promise<{ error?: string; ok?: boolean }> {
  await requireUser();
  const parsed = updateLimitsSchema.safeParse(input);
  if (!parsed.success) return { error: "Valores inválidos: o mínimo não pode ser negativo e a quantidade por caixa precisa ser maior que zero." };

  const supabase = await createClient();
  for (const row of parsed.data) {
    const { error } = await supabase
      .from("products")
      .update({ min_quantity: row.min_quantity, units_per_box: row.units_per_box })
      .eq("id", row.product_id);
    if (error) return { error: "Não foi possível salvar todas as alterações. Verifique se você tem acesso ao setor." };
  }

  for (const path of ["/estoque", "/estoque/mes", "/estoque/saldo", "/estoque/folha", "/produtos"]) revalidatePath(path);
  return { ok: true };
}
