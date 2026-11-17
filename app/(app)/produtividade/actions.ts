"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { loadCatalog } from "@/lib/erp/queries";
import { loadProductionDay } from "@/lib/erp/production-day";
import { fortalezaDateISO } from "@/lib/dates";
import type { ProductionDayData } from "@/lib/erp/manual-production";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha uma data válida.");

export type DayResult = { error: string } | { data: ProductionDayData };

export async function loadProductionDayAction(date: string): Promise<DayResult> {
  await requireUser();
  const parsed = dateSchema.safeParse(date);
  if (!parsed.success || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) return { error: "Escolha uma data válida." };
  const supabase = await createClient();
  return { data: await loadProductionDay(supabase, date) };
}

const saveSchema = z.object({
  date: dateSchema,
  entries: z
    .array(
      z.object({
        productCode: z.string().min(1).max(30),
        quantity: z.number().positive("A quantidade precisa ser maior que zero.").max(10_000_000),
        scheduleItemId: z.string().uuid().nullable(),
      })
    )
    .max(300),
});

export type SaveResult = { error?: string; ok?: boolean; saved?: number };

/**
 * Saves the production of one day: what is in `entries` replaces what was typed for that day before
 * (a product left out of the list is removed). Writes go through the user's own session, so the same
 * permission as the production schedule applies.
 */
export async function saveProductionDay(input: unknown): Promise<SaveResult> {
  const { userId } = await requireUser();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { date, entries } = parsed.data;
  if (Number.isNaN(Date.parse(`${date}T12:00:00Z`))) return { error: "Escolha uma data válida." };
  if (date > fortalezaDateISO()) return { error: "A data da produção não pode ser no futuro." };

  const codes = entries.map((e) => e.productCode);
  if (new Set(codes).size !== codes.length) return { error: "O mesmo produto está na lista duas vezes." };
  const catalog = new Set((await loadCatalog()).map((c) => c.product_code));
  if (codes.some((c) => !catalog.has(c))) return { error: "Há um produto que não existe mais no cadastro do ERP." };

  const supabase = await createClient();
  const NO_ACCESS = "Não foi possível salvar. Verifique se você tem permissão para lançar produção.";

  if (entries.length > 0) {
    const { error } = await supabase.from("manual_productions").upsert(
      entries.map((e) => ({
        production_date: date,
        product_code: e.productCode,
        quantity: Math.round(e.quantity * 1000) / 1000,
        schedule_item_id: e.scheduleItemId,
        created_by: userId,
      })),
      { onConflict: "production_date,product_code" }
    );
    if (error) return { error: NO_ACCESS };
  }

  const removal = supabase.from("manual_productions").delete().eq("production_date", date);
  const { error: removeError } = await (entries.length > 0
    ? removal.not("product_code", "in", `(${codes.map((c) => `"${c}"`).join(",")})`)
    : removal);
  if (removeError) return { error: NO_ACCESS };

  // remember which ERP product each schedule line produces, so the next day opens already filled
  for (const e of entries) {
    if (e.scheduleItemId) await supabase.from("schedule_items").update({ erp_product_code: e.productCode }).eq("id", e.scheduleItemId);
  }

  return { ok: true, saved: entries.length };
}
