"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";

export type HortifrutiResult = { error?: string; saved?: number };

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const saveCountSchema = z.object({
  date: dateSchema,
  entries: z
    .array(z.object({ raw_material_id: z.string().uuid(), quantity: z.number().min(0).max(1_000_000) }))
    .min(1)
    .max(200),
});

/** Saves the quantities counted on a day (autosave sends only what changed). */
export async function saveHortifrutiCount(input: unknown): Promise<HortifrutiResult> {
  const { userId } = await requireUser();
  const parsed = saveCountSchema.safeParse(input);
  if (!parsed.success) return { error: "Contagem inválida." };

  const supabase = await createClient();
  const { error } = await supabase.from("hortifruti_counts").upsert(
    parsed.data.entries.map((e) => ({
      count_date: parsed.data.date,
      raw_material_id: e.raw_material_id,
      quantity: e.quantity,
      counted_by: userId,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "count_date,raw_material_id" }
  );
  if (error) return { error: "Não foi possível salvar. Verifique se você tem permissão para contar o hortifrut." };

  revalidatePath("/compras/hortifrut/solicitacao");
  return { saved: parsed.data.entries.length };
}

/** New code for the public count link; the old link stops working. */
export async function rotateCountToken(): Promise<HortifrutiResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "hortifruti_count_token", value: randomBytes(18).toString("base64url"), updated_at: new Date().toISOString() });
  if (error) return { error: "Não foi possível gerar o link." };
  revalidatePath("/compras/hortifrut");
  return {};
}

/** Links a schedule item to the technical sheet (a product "p:<id>" or a subproduct "s:<id>") its demand is read from. */
export async function linkScheduleItem(scheduleItemId: string, target: string): Promise<HortifrutiResult> {
  await requireUser();
  if (!z.string().uuid().safeParse(scheduleItemId).success) return { error: "Item inválido." };
  const match = /^([ps]):([0-9a-f-]{36})$/i.exec(target);
  if (target !== "" && !match) return { error: "Ficha inválida." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule_items")
    .update({
      recipe_product_id: match?.[1] === "p" ? match[2] : null,
      recipe_subproduct_id: match?.[1] === "s" ? match[2] : null,
    })
    .eq("id", scheduleItemId);
  if (error) return { error: "Não foi possível vincular. Verifique se você pode editar o cronograma." };

  revalidatePath("/compras/hortifrut/demanda");
  revalidatePath("/compras/hortifrut/solicitacao");
  return {};
}
