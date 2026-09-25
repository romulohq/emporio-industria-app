"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/get-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { stockReportRowSchema } from "@/lib/validations/stock-report";

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
  revalidatePath("/pedidos/rotas");
  revalidatePath("/pedidos");
}
