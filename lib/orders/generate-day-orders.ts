import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { weekdayOfISODate } from "@/lib/dates";
import type { Product, ProductionOrderContribution, StoreProductMin, StoreStockReport } from "@/lib/types/database.types";

type Contribution = { quantity: number; reportId: string };

/**
 * Generates (or refreshes) the production orders for every store scheduled
 * to deliver on `deliveryDateISO`, using each store's latest stock report
 * submitted for THIS exact delivery cycle (store_stock_reports.delivery_date
 * = deliveryDateISO) — a report from a past or future cycle is never reused,
 * so a store that hasn't reported yet for this cycle simply contributes
 * nothing (see the "Pedido não recebido" list computed in the Pedidos page).
 * A store's contribution that an admin has manually locked (see
 * lib/orders/manual-contribution.ts) is left untouched — it stops following
 * the automatic "latest report wins" rule until the admin reverts it.
 */
export async function generateDayOrders(deliveryDateISO: string) {
  const admin = createAdminClient();
  const weekday = weekdayOfISODate(deliveryDateISO);

  const { data: dayStores } = await admin
    .from("store_delivery_days")
    .select("store_id")
    .eq("weekday", weekday);

  const storeIds = [...new Set((dayStores ?? []).map((d) => d.store_id as string))];
  if (storeIds.length === 0) return { productsUpdated: 0 };

  const { data: mins } = await admin.from("store_product_mins").select("*").in("store_id", storeIds);
  const minRows = (mins ?? []) as StoreProductMin[];
  if (minRows.length === 0) return { productsUpdated: 0 };

  const productIds = [...new Set(minRows.map((m) => m.product_id))];

  const [{ data: products }, { data: reports }] = await Promise.all([
    admin.from("products").select("*").in("id", productIds),
    admin
      .from("store_stock_reports")
      .select("*")
      .eq("delivery_date", deliveryDateISO)
      .in("store_id", storeIds)
      .in("product_id", productIds)
      .order("created_at", { ascending: false }),
  ]);

  const productsById = new Map(((products ?? []) as Product[]).map((p) => [p.id, p]));

  const latestReportByStoreProduct = new Map<string, StoreStockReport>();
  for (const report of (reports ?? []) as StoreStockReport[]) {
    const key = `${report.store_id}:${report.product_id}`;
    if (!latestReportByStoreProduct.has(key)) latestReportByStoreProduct.set(key, report);
  }

  // product_id -> store_id -> deficit computed from the latest report
  const byProduct = new Map<string, Map<string, Contribution>>();
  for (const min of minRows) {
    const report = latestReportByStoreProduct.get(`${min.store_id}:${min.product_id}`);
    if (!report) continue; // store hasn't reported this product yet — nothing to go on

    const deficit = Math.max(0, Math.round((min.min_quantity - report.quantity_reported) * 1000) / 1000);
    if (deficit <= 0) continue;

    const storesMap = byProduct.get(min.product_id) ?? new Map<string, Contribution>();
    storesMap.set(min.store_id, { quantity: deficit, reportId: report.id });
    byProduct.set(min.product_id, storesMap);
  }

  let productsUpdated = 0;

  for (const productId of new Set([...byProduct.keys()])) {
    const product = productsById.get(productId);
    if (!product) continue;

    const fresh = byProduct.get(productId) ?? new Map<string, Contribution>();

    const { data: existingOrder } = await admin
      .from("production_orders")
      .select("*")
      .eq("delivery_date", deliveryDateISO)
      .eq("product_id", productId)
      .eq("source", "auto_route")
      .in("status", ["pending", "in_progress"])
      .maybeSingle();

    const { data: existingContributionsData } = existingOrder
      ? await admin.from("production_order_contributions").select("*").eq("order_id", existingOrder.id)
      : { data: [] as ProductionOrderContribution[] };
    const existingContributions = (existingContributionsData ?? []) as ProductionOrderContribution[];
    const existingByStore = new Map(existingContributions.map((c) => [c.store_id, c]));

    // locked contributions are frozen by an admin — keep them exactly as is
    const finalStoreIds = new Set<string>([...fresh.keys(), ...existingContributions.filter((c) => c.locked).map((c) => c.store_id)]);

    let total = 0;
    for (const storeId of finalStoreIds) {
      const existing = existingByStore.get(storeId);
      total += existing?.locked ? existing.quantity : (fresh.get(storeId)?.quantity ?? 0);
    }

    if (total <= 0) {
      if (existingOrder) {
        await admin.from("production_orders").update({ status: "cancelled" }).eq("id", existingOrder.id);
      }
      continue;
    }

    const generatedAt = new Date().toISOString();

    let orderId = existingOrder?.id;
    if (orderId) {
      await admin.from("production_orders").update({ quantity: total, generated_at: generatedAt }).eq("id", orderId);
    } else {
      const { data: inserted, error } = await admin
        .from("production_orders")
        .insert({
          product_id: productId,
          sector_id: product.sector_id,
          delivery_date: deliveryDateISO,
          source: "auto_route",
          status: "pending",
          priority: "medium",
          quantity: total,
          requested_by: null,
          generated_at: generatedAt,
        })
        .select("id")
        .single();
      if (error || !inserted) continue;
      orderId = inserted.id;
    }

    for (const storeId of finalStoreIds) {
      const existing = existingByStore.get(storeId);
      if (existing?.locked) continue; // untouched

      const contribution = fresh.get(storeId);
      if (!contribution) continue;

      await admin.from("production_order_contributions").upsert(
        {
          order_id: orderId,
          store_id: storeId,
          sector_id: product.sector_id,
          quantity: contribution.quantity,
          report_id: contribution.reportId,
          locked: false,
        },
        { onConflict: "order_id,store_id" }
      );
    }

    for (const [storeId, existing] of existingByStore) {
      if (existing.locked) continue;
      if (!fresh.has(storeId)) {
        await admin
          .from("production_order_contributions")
          .delete()
          .eq("order_id", orderId)
          .eq("store_id", storeId);
      }
    }

    productsUpdated += 1;
  }

  return { productsUpdated };
}
