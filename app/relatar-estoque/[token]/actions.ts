"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { stockReportRowSchema } from "@/lib/validations/stock-report";
import { computeCurrentCycle } from "@/lib/delivery-schedule";
import { compareSectorNames } from "@/lib/format/sectors";
import type { StoreDeliveryDay } from "@/lib/types/database.types";

export type SentReport = {
  storeName: string;
  /** ISO timestamp of when the report was sent */
  sentAt: string;
  groups: { sectorName: string; items: { name: string; unit: string; quantity: number }[] }[];
};

export type SubmitState = { error?: string; success?: boolean; report?: SentReport } | undefined;

export async function submitStockReport(
  token: string,
  _prevState: SubmitState,
  formData: FormData
): Promise<SubmitState> {
  const admin = createAdminClient();

  const { data: store } = await admin
    .from("stores")
    .select("id, name, active")
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

  const { data: deliveryDays } = await admin
    .from("store_delivery_days")
    .select("*")
    .eq("store_id", store.id);

  const cycle = computeCurrentCycle(((deliveryDays ?? []) as StoreDeliveryDay[]).map((d) => d.weekday));

  const submissionId = randomUUID();
  const rows: {
    store_id: string;
    product_id: string;
    quantity_reported: number;
    submission_id: string;
    delivery_date: string | null;
  }[] = [];

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
      delivery_date: cycle?.deliveryDate ?? null,
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

  const productIds = rows.map((r) => r.product_id);
  const { data: products } = await admin.from("products").select("id, name, unit, sector_id").in("id", productIds);
  const sectorIds = [...new Set((products ?? []).map((p) => p.sector_id as string))];
  const { data: sectors } = await admin.from("sectors").select("id, name").in("id", sectorIds);
  const sectorNameById = new Map((sectors ?? []).map((s) => [s.id as string, s.name as string]));
  const productById = new Map((products ?? []).map((p) => [p.id as string, p]));

  const itemsBySector = new Map<string, SentReport["groups"][number]["items"]>();
  for (const row of rows) {
    const product = productById.get(row.product_id);
    if (!product) continue;
    const sectorName = sectorNameById.get(product.sector_id as string) ?? "Outros";
    const list = itemsBySector.get(sectorName) ?? [];
    list.push({ name: product.name as string, unit: product.unit as string, quantity: row.quantity_reported });
    itemsBySector.set(sectorName, list);
  }
  const groups = [...itemsBySector.entries()]
    .map(([sectorName, items]) => ({ sectorName, items: items.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => compareSectorNames(a.sectorName, b.sectorName));

  return { success: true, report: { storeName: store.name as string, sentAt: new Date().toISOString(), groups } };
}
