import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { weekdayOfISODate } from "@/lib/dates";
import type { Product, StoreProductMin, StoreStockReport } from "@/lib/types/database.types";

export type PlannedContribution = { quantity: number; reportId: string };

export type DayOrderPlan = {
  /** product_id -> store_id -> deficit computed from that store's report for this exact cycle */
  byProduct: Map<string, Map<string, PlannedContribution>>;
  productsById: Map<string, Product>;
};

/**
 * Computes what a day's auto_route orders should look like — the same
 * calculation lib/orders/generate-day-orders.ts writes to the database —
 * without writing anything. Shared by the daily generator and by the
 * late-report diff/regeneration flow (lib/orders/diff-day-orders.ts).
 *
 * `excludeReportIds` lets a caller ask "what if this specific report never
 * arrived" — used when an admin unchecks a late store before regenerating.
 */
export async function computeDayOrderPlan(
  deliveryDateISO: string,
  options: { excludeReportIds?: Set<string> } = {}
): Promise<DayOrderPlan> {
  const admin = createAdminClient();
  const weekday = weekdayOfISODate(deliveryDateISO);

  const { data: dayStores } = await admin
    .from("store_delivery_days")
    .select("store_id")
    .eq("weekday", weekday);

  const storeIds = [...new Set((dayStores ?? []).map((d) => d.store_id as string))];
  if (storeIds.length === 0) return { byProduct: new Map(), productsById: new Map() };

  const { data: mins } = await admin.from("store_product_mins").select("*").in("store_id", storeIds);
  const minRows = (mins ?? []) as StoreProductMin[];
  if (minRows.length === 0) return { byProduct: new Map(), productsById: new Map() };

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

  const excludeIds = options.excludeReportIds ?? new Set<string>();
  const latestReportByStoreProduct = new Map<string, StoreStockReport>();
  for (const report of (reports ?? []) as StoreStockReport[]) {
    if (excludeIds.has(report.id)) continue;
    const key = `${report.store_id}:${report.product_id}`;
    if (!latestReportByStoreProduct.has(key)) latestReportByStoreProduct.set(key, report);
  }

  const byProduct = new Map<string, Map<string, PlannedContribution>>();
  for (const min of minRows) {
    const report = latestReportByStoreProduct.get(`${min.store_id}:${min.product_id}`);
    if (!report) continue;

    const deficit = Math.max(0, Math.round((min.min_quantity - report.quantity_reported) * 1000) / 1000);
    if (deficit <= 0) continue;

    const storesMap = byProduct.get(min.product_id) ?? new Map<string, PlannedContribution>();
    storesMap.set(min.store_id, { quantity: deficit, reportId: report.id });
    byProduct.set(min.product_id, storesMap);
  }

  return { byProduct, productsById };
}
