"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDayOrders } from "@/lib/orders/generate-day-orders";
import { regenerateSectorDayOrder } from "@/lib/orders/regenerate-day-order";
import { fortalezaDateISO } from "@/lib/dates";
import { getUndecidedLateReports, groupLateReports } from "@/lib/orders/late-reports";
import { deliveryDatesProducedOn } from "@/lib/delivery-schedule";
import {
  manualContributionSchema,
  clearContributionSchema,
  lateStoreSchema,
} from "@/lib/validations/manual-contribution";

function revalidateOrdersPaths() {
  revalidatePath("/pedidos");
  revalidatePath("/pedidos/dia");
}

/**
 * "Atualizar ordem de produção": orders are generated automatically each
 * production day, so this is how late reports get accepted — every undecided
 * late report is included by regenerating its sector/day order (versioned,
 * with the decision recorded). Also generates any of today's orders that
 * somehow don't exist yet.
 */
export async function updateDayOrders() {
  const { userId } = await requireAdmin();
  const supabase = await createClient();
  const admin = createAdminClient();

  for (const group of groupLateReports(await getUndecidedLateReports())) {
    const reportIds = group.items.map((item) => item.reportId);
    const storeNames = [...new Set(group.items.map((item) => item.storeName))];

    await regenerateSectorDayOrder(
      group.sectorId,
      group.deliveryDate,
      new Set(),
      `Inclui pedido(s) atrasado(s): ${storeNames.join(", ")}`,
      userId
    );

    await supabase.from("late_report_decisions").insert(
      reportIds.map((report_id) => ({
        report_id,
        sector_id: group.sectorId,
        delivery_date: group.deliveryDate,
        decision: "regenerated" as const,
        decided_by: userId,
      }))
    );
    // store_stock_reports has no update RLS policy, so this must go through the admin client
    await admin.from("store_stock_reports").update({ late_acknowledged: true }).in("id", reportIds);
  }

  const todayDeliveryDates = deliveryDatesProducedOn(fortalezaDateISO());
  if (todayDeliveryDates.length) {
    const { data: existing } = await admin
      .from("production_orders")
      .select("delivery_date")
      .eq("source", "auto_route")
      .in("delivery_date", todayDeliveryDates);
    const existingDates = new Set((existing ?? []).map((o) => o.delivery_date as string));
    for (const deliveryDate of todayDeliveryDates) {
      if (!existingDates.has(deliveryDate)) await generateDayOrders(deliveryDate);
    }
  }

  revalidateOrdersPaths();
  redirect("/pedidos/dia");
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

/** "Não considerar o pedido": keeps the current order and keeps this store's late report out of every future regeneration. */
export async function dismissLateStore(formData: FormData) {
  const { userId } = await requireAdmin();
  const parsed = lateStoreSchema.safeParse({
    store_id: formData.get("store_id"),
    delivery_date: formData.get("delivery_date"),
  });
  if (!parsed.success) return;

  const rows = (await getUndecidedLateReports()).filter(
    (r) => r.storeId === parsed.data.store_id && r.deliveryDate === parsed.data.delivery_date
  );
  if (rows.length === 0) return;

  const supabase = await createClient();
  await supabase.from("late_report_decisions").insert(
    rows.map((r) => ({
      report_id: r.reportId,
      sector_id: r.sectorId,
      delivery_date: r.deliveryDate,
      decision: "kept" as const,
      decided_by: userId,
    }))
  );
  // store_stock_reports has no update RLS policy, so this must go through the admin client
  await createAdminClient()
    .from("store_stock_reports")
    .update({ late_acknowledged: true })
    .in("id", rows.map((r) => r.reportId));

  revalidateOrdersPaths();
}

/**
 * "Atualizar ordem de produção" for one store's late order: regenerates each affected
 * sector's order (versioned) including this store's late reports; other stores' still-undecided
 * late reports stay out until they are decided themselves.
 */
export async function includeLateStore(formData: FormData) {
  const { userId } = await requireAdmin();
  const parsed = lateStoreSchema.safeParse({
    store_id: formData.get("store_id"),
    delivery_date: formData.get("delivery_date"),
  });
  if (!parsed.success) return;

  const undecided = await getUndecidedLateReports();
  const mine = undecided.filter(
    (r) => r.storeId === parsed.data.store_id && r.deliveryDate === parsed.data.delivery_date
  );
  if (mine.length === 0) return;

  const supabase = await createClient();
  const sectorIds = [...new Set(mine.map((r) => r.sectorId))];

  for (const sectorId of sectorIds) {
    const others = undecided
      .filter(
        (r) =>
          r.sectorId === sectorId &&
          r.deliveryDate === parsed.data.delivery_date &&
          r.storeId !== parsed.data.store_id
      )
      .map((r) => r.reportId);

    await regenerateSectorDayOrder(
      sectorId,
      parsed.data.delivery_date,
      new Set(others),
      `Inclui pedido atrasado: ${mine[0].storeName}`,
      userId
    );
  }

  await supabase.from("late_report_decisions").insert(
    mine.map((r) => ({
      report_id: r.reportId,
      sector_id: r.sectorId,
      delivery_date: r.deliveryDate,
      decision: "regenerated" as const,
      decided_by: userId,
    }))
  );
  await createAdminClient()
    .from("store_stock_reports")
    .update({ late_acknowledged: true })
    .in("id", mine.map((r) => r.reportId));

  revalidateOrdersPaths();
}
