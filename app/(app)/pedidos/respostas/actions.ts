"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/get-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { stockReportRowSchema } from "@/lib/validations/stock-report";
import { z } from "zod";
import { fortalezaDateISO } from "@/lib/dates";

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
 * What the submission put into production orders is taken back out, so a deleted test send does not
 * keep feeding an order: for orders whose delivery date is today or later the store's quantity is
 * removed (an order that ends up empty is cancelled). Orders of past dates are history: they keep
 * their quantities and only lose the link to the deleted report. Late-report decisions about the
 * submission are removed with it.
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

    const { data: contributions, error: contribReadError } = await admin
      .from("production_order_contributions")
      .select("order_id, store_id, quantity")
      .in("report_id", ids);
    if (contribReadError) return { error: "Não foi possível excluir. Tente novamente.", deleted };

    if ((contributions ?? []).length > 0) {
      const orderIds = [...new Set((contributions ?? []).map((c) => c.order_id as string))];
      const { data: orders } = await admin
        .from("production_orders")
        .select("id, delivery_date, quantity")
        .in("id", orderIds);
      const orderById = new Map((orders ?? []).map((o) => [o.id as string, o]));
      const today = fortalezaDateISO();

      for (const contribution of contributions ?? []) {
        const order = orderById.get(contribution.order_id as string);
        const open = !!order && !!order.delivery_date && String(order.delivery_date).slice(0, 10) >= today;
        if (open && order) {
          const { error: removeError } = await admin
            .from("production_order_contributions")
            .delete()
            .eq("order_id", contribution.order_id)
            .eq("store_id", contribution.store_id);
          if (removeError) return { error: "Não foi possível excluir. Tente novamente.", deleted };
          const remaining = Math.max(0, Math.round((Number(order.quantity) - Number(contribution.quantity)) * 1000) / 1000);
          order.quantity = remaining;
          const { error: orderError } = await admin
            .from("production_orders")
            .update(remaining <= 0 ? { status: "cancelled" } : { quantity: remaining })
            .eq("id", order.id);
          if (orderError) return { error: "Não foi possível excluir. Tente novamente.", deleted };
        } else {
          const { error: unlinkError } = await admin
            .from("production_order_contributions")
            .update({ report_id: null })
            .eq("order_id", contribution.order_id)
            .eq("store_id", contribution.store_id);
          if (unlinkError) return { error: "Não foi possível excluir. Tente novamente.", deleted };
        }
      }
    }

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
