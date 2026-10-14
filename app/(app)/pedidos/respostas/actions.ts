"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/get-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { stockReportRowSchema } from "@/lib/validations/stock-report";
import { z } from "zod";

/**
 * Records a correction as a brand-new report row (same mechanism the public
 * form uses) instead of mutating history, so the ledger stays an accurate
 * audit trail and the order-sync trigger recalculates correctly. Uses the
 * admin client because store_stock_reports has no authenticated insert
 * policy — only this trusted, requireAdmin()-gated path may write here.
 */
export async function correctStockReport(formData: FormData) {
  await requireAdmin();

  const storeId = String(formData.get("store_id"));
  const parsed = stockReportRowSchema.safeParse({
    product_id: formData.get("product_id"),
    quantity_reported: formData.get("quantity_reported"),
  });

  if (!parsed.success || !storeId) return;

  const admin = createAdminClient();
  await admin.from("store_stock_reports").insert({
    store_id: storeId,
    product_id: parsed.data.product_id,
    quantity_reported: parsed.data.quantity_reported,
    submission_id: randomUUID(),
  });

  revalidatePath("/pedidos/respostas");
  revalidatePath("/pedidos/dia");
  revalidatePath("/pedidos");
}

const deleteSubmissionsSchema = z.array(z.string().uuid()).min(1).max(100);

export type DeleteSubmissionsResult = { error?: string; deleted?: number };

/**
 * Permanently deletes whole stock submissions (every product row sent together by a store).
 * Orders already generated are left exactly as they are: the contribution rows only lose their
 * link to the deleted report, and the late-report decisions about it are removed with it.
 * Uses the admin client because store_stock_reports has no authenticated delete policy.
 */
export async function deleteStockSubmissions(input: unknown): Promise<DeleteSubmissionsResult> {
  await requireAdmin();
  const parsed = deleteSubmissionsSchema.safeParse(input);
  if (!parsed.success) return { error: "Selecione ao menos um envio (no máximo 100 por vez)." };

  const admin = createAdminClient();
  let deleted = 0;
  for (const submissionId of parsed.data) {
    const { data: rows, error: readError } = await admin
      .from("store_stock_reports")
      .select("id")
      .eq("submission_id", submissionId);
    if (readError) return { error: "Não foi possível excluir. Tente novamente.", deleted };
    const ids = (rows ?? []).map((r) => r.id as string);
    if (ids.length === 0) continue;

    const { error: contribError } = await admin
      .from("production_order_contributions")
      .update({ report_id: null })
      .in("report_id", ids);
    if (contribError) return { error: "Não foi possível excluir. Tente novamente.", deleted };

    const { error: decisionError } = await admin.from("late_report_decisions").delete().in("report_id", ids);
    if (decisionError) return { error: "Não foi possível excluir. Tente novamente.", deleted };

    const { error: deleteError } = await admin.from("store_stock_reports").delete().eq("submission_id", submissionId);
    if (deleteError) return { error: "Não foi possível excluir. Tente novamente.", deleted };
    deleted += 1;
  }

  revalidatePath("/pedidos/respostas");
  revalidatePath("/pedidos/dia");
  revalidatePath("/pedidos");
  return { deleted };
}
