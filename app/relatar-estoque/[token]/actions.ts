"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { stockReportRowSchema } from "@/lib/validations/stock-report";

export type SubmitState = { error?: string; success?: boolean } | undefined;

export async function submitStockReport(
  token: string,
  _prevState: SubmitState,
  formData: FormData
): Promise<SubmitState> {
  const admin = createAdminClient();

  const { data: store } = await admin
    .from("stores")
    .select("id, active")
    .eq("access_token", token)
    .single();

  if (!store || !store.active) {
    return { error: "Link inválido ou loja inativa." };
  }

  const { data: allowedMins } = await admin
    .from("store_product_mins")
    .select("product_id")
    .eq("store_id", store.id);

  const allowedProductIds = new Set((allowedMins ?? []).map((m) => m.product_id));

  const submissionId = randomUUID();
  const rows: { store_id: string; product_id: string; quantity_reported: number; submission_id: string }[] =
    [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("qty_")) continue;
    const productId = key.slice(4);
    if (!allowedProductIds.has(productId)) continue;

    const parsed = stockReportRowSchema.safeParse({ product_id: productId, quantity_reported: value });
    if (!parsed.success) continue;

    rows.push({
      store_id: store.id,
      product_id: parsed.data.product_id,
      quantity_reported: parsed.data.quantity_reported,
      submission_id: submissionId,
    });
  }

  if (rows.length === 0) {
    return { error: "Informe ao menos uma quantidade." };
  }

  const { error } = await admin.from("store_stock_reports").insert(rows);

  if (error) {
    return { error: "Não foi possível enviar o relato. Tente novamente." };
  }

  revalidatePath(`/relatar-estoque/${token}`);
  return { success: true };
}
