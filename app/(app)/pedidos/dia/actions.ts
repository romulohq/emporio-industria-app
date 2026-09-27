"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/get-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDayOrders } from "@/lib/orders/generate-day-orders";
import { saoPauloDateISO } from "@/lib/dates";
import { manualContributionSchema, clearContributionSchema } from "@/lib/validations/manual-contribution";

function revalidateOrdersPaths() {
  revalidatePath("/pedidos");
  revalidatePath("/pedidos/dia");
}

export async function generateTomorrowOrders() {
  await requireAdmin();
  await generateDayOrders(saoPauloDateISO(1));
  revalidateOrdersPaths();
}

/** Pins a store's contribution to a specific past report instead of its latest one. */
export async function setManualContribution(formData: FormData) {
  await requireAdmin();

  const parsed = manualContributionSchema.safeParse({
    order_id: formData.get("order_id"),
    store_id: formData.get("store_id"),
    report_id: formData.get("report_id"),
  });
  if (!parsed.success) return;
  const { order_id, store_id, report_id } = parsed.data;

  const admin = createAdminClient();

  const [{ data: order }, { data: contribution }, { data: report }] = await Promise.all([
    admin.from("production_orders").select("*").eq("id", order_id).single(),
    admin.from("production_order_contributions").select("*").eq("order_id", order_id).eq("store_id", store_id).single(),
    admin.from("store_stock_reports").select("*").eq("id", report_id).single(),
  ]);
  if (!order || !contribution || !report) return;

  const { data: min } = await admin
    .from("store_product_mins")
    .select("*")
    .eq("store_id", store_id)
    .eq("product_id", order.product_id)
    .maybeSingle();

  const newQuantity = Math.max(0, Math.round(((min?.min_quantity ?? 0) - report.quantity_reported) * 1000) / 1000);

  await admin
    .from("production_order_contributions")
    .update({ quantity: newQuantity, report_id: report.id, locked: true })
    .eq("order_id", order_id)
    .eq("store_id", store_id);

  await admin
    .from("production_orders")
    .update({ quantity: order.quantity + (newQuantity - contribution.quantity) })
    .eq("id", order_id);

  revalidateOrdersPaths();
}

/** Reverts a store's contribution back to following its latest report automatically. */
export async function clearManualContribution(formData: FormData) {
  await requireAdmin();

  const parsed = clearContributionSchema.safeParse({
    order_id: formData.get("order_id"),
    store_id: formData.get("store_id"),
  });
  if (!parsed.success) return;
  const { order_id, store_id } = parsed.data;

  const admin = createAdminClient();

  const [{ data: order }, { data: contribution }] = await Promise.all([
    admin.from("production_orders").select("*").eq("id", order_id).single(),
    admin.from("production_order_contributions").select("*").eq("order_id", order_id).eq("store_id", store_id).single(),
  ]);
  if (!order || !contribution) return;

  const [{ data: min }, { data: latestReport }] = await Promise.all([
    admin
      .from("store_product_mins")
      .select("*")
      .eq("store_id", store_id)
      .eq("product_id", order.product_id)
      .maybeSingle(),
    admin
      .from("store_stock_reports")
      .select("*")
      .eq("store_id", store_id)
      .eq("product_id", order.product_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const newQuantity = latestReport
    ? Math.max(0, Math.round(((min?.min_quantity ?? 0) - latestReport.quantity_reported) * 1000) / 1000)
    : 0;

  if (newQuantity <= 0 || !latestReport) {
    await admin
      .from("production_order_contributions")
      .delete()
      .eq("order_id", order_id)
      .eq("store_id", store_id);

    const remaining = order.quantity - contribution.quantity;
    await admin
      .from("production_orders")
      .update(remaining <= 0 ? { status: "cancelled" as const } : { quantity: remaining })
      .eq("id", order_id);
  } else {
    await admin
      .from("production_order_contributions")
      .update({ quantity: newQuantity, report_id: latestReport.id, locked: false })
      .eq("order_id", order_id)
      .eq("store_id", store_id);

    await admin
      .from("production_orders")
      .update({ quantity: order.quantity + (newQuantity - contribution.quantity) })
      .eq("id", order_id);
  }

  revalidateOrdersPaths();
}
