"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDayOrders } from "@/lib/orders/generate-day-orders";
import { regenerateSectorDayOrder } from "@/lib/orders/regenerate-day-order";
import { fortalezaDateISO } from "@/lib/dates";
import { deliveryDatesProducedOn } from "@/lib/delivery-schedule";
import {
  manualContributionSchema,
  clearContributionSchema,
  keepCurrentOrderSchema,
  regenerateWithLateReportsSchema,
} from "@/lib/validations/manual-contribution";

function revalidateOrdersPaths() {
  revalidatePath("/pedidos");
  revalidatePath("/pedidos/dia");
}

/**
 * Generates today's production orders — for every delivery whose production
 * day is today (freezing them from further automatic changes) — and opens the
 * print view for the first of them. Does nothing on a day with no production.
 */
export async function generateTodayProductionOrders() {
  await requireAdmin();
  const deliveryDates = deliveryDatesProducedOn(fortalezaDateISO());
  for (const deliveryDate of deliveryDates) {
    await generateDayOrders(deliveryDate);
  }
  revalidateOrdersPaths();

  const { data: generated } = deliveryDates.length
    ? await createAdminClient()
        .from("production_orders")
        .select("delivery_date")
        .eq("source", "auto_route")
        .in("delivery_date", deliveryDates)
        .order("delivery_date", { ascending: true })
        .limit(1)
    : { data: [] };
  const printDate = generated?.[0]?.delivery_date;
  redirect(printDate ? `/pedidos/dia/imprimir?date=${printDate}` : "/pedidos/dia");
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

/** Keeps the current order as-is for a group of late reports — records who decided and when. */
export async function keepCurrentOrder(formData: FormData) {
  const { userId } = await requireAdmin();

  const parsed = keepCurrentOrderSchema.safeParse({
    sector_id: formData.get("sector_id"),
    delivery_date: formData.get("delivery_date"),
    report_ids: formData.getAll("report_ids"),
  });
  if (!parsed.success) return;
  const { sector_id, delivery_date, report_ids } = parsed.data;

  const supabase = await createClient();

  await supabase.from("late_report_decisions").insert(
    report_ids.map((report_id) => ({
      report_id,
      sector_id,
      delivery_date,
      decision: "kept" as const,
      decided_by: userId,
    }))
  );

  // store_stock_reports has no update RLS policy (only the sync trigger writes to it),
  // so this must go through the admin client or it silently no-ops.
  await createAdminClient().from("store_stock_reports").update({ late_acknowledged: true }).in("id", report_ids);

  revalidateOrdersPaths();
}

/** Regenerates a sector's day order including (or excluding) specific late reports, versioning the previous state. */
export async function regenerateWithLateReports(formData: FormData) {
  const { userId } = await requireAdmin();

  const parsed = regenerateWithLateReportsSchema.safeParse({
    sector_id: formData.get("sector_id"),
    delivery_date: formData.get("delivery_date"),
    include_report_ids: formData.getAll("include_report_ids"),
    exclude_report_ids: formData.getAll("exclude_report_ids"),
  });
  if (!parsed.success) return;
  const { sector_id, delivery_date, include_report_ids, exclude_report_ids } = parsed.data;

  const { data: stores } = include_report_ids.length
    ? await createAdminClient()
        .from("store_stock_reports")
        .select("store_id, stores(name)")
        .in("id", include_report_ids)
    : { data: [] as { store_id: string; stores: { name: string } | null }[] };
  const storeNames = (stores ?? []).map((s) => s.stores?.name).filter(Boolean);
  const reason = storeNames.length ? `Inclui pedido(s) atrasado(s): ${storeNames.join(", ")}` : null;

  const { versionNumber } = await regenerateSectorDayOrder(
    sector_id,
    delivery_date,
    new Set(exclude_report_ids),
    reason,
    userId
  );

  const allDecided = [...include_report_ids, ...exclude_report_ids];
  if (allDecided.length) {
    const supabase = await createClient();
    await supabase.from("late_report_decisions").insert(
      allDecided.map((report_id) => ({
        report_id,
        sector_id,
        delivery_date,
        decision: "regenerated" as const,
        decided_by: userId,
      }))
    );
    // store_stock_reports has no update RLS policy (only the sync trigger writes to it),
    // so this must go through the admin client or it silently no-ops.
    await createAdminClient().from("store_stock_reports").update({ late_acknowledged: true }).in("id", allDecided);
  }

  revalidateOrdersPaths();
  revalidatePath("/pedidos/dia/imprimir-colaboradores");
  redirect(`/pedidos/dia/imprimir-colaboradores?date=${delivery_date}&sector=${sector_id}&versao=${versionNumber}`);
}
