import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { productionDateForDelivery, sendDeadlineForDelivery } from "@/lib/delivery-schedule";
import { zonedInstant } from "@/lib/dates";

/** When the daily cron generates the day's orders (vercel.json: 08:00 UTC = 05:00 America/Fortaleza). */
const GENERATION_TIME = "05:00";

/**
 * A report that arrives after its delivery's send deadline, when no order was generated for that
 * delivery, has no order to be flagged against (the database trigger only flags against an
 * existing order). It is marked `late_without_order` instead, so it shows up as "late, waiting for
 * approval" and approving it generates the order.
 *
 * Reports that arrive before the day's generation moment are not marked: the generation still
 * picks them up (late, but in time to be included). Only reports with a deficit are marked — a
 * store at or above its minimum would not add anything to an order.
 */
export async function flagLateWithoutOrder(reportIds: string[], now: Date = new Date()): Promise<number> {
  if (reportIds.length === 0) return 0;
  const admin = createAdminClient();

  const { data: reports } = await admin
    .from("store_stock_reports")
    .select("id, store_id, product_id, quantity_reported, delivery_date, created_at")
    .in("id", reportIds)
    .not("delivery_date", "is", null);
  if (!reports?.length) return 0;

  // deliveries that already have a generated order are handled by the trigger / relink flow
  const deliveryDates = [...new Set(reports.map((r) => r.delivery_date as string))];
  const { data: generated } = await admin
    .from("production_orders")
    .select("delivery_date")
    .eq("source", "auto_route")
    .neq("status", "cancelled")
    .not("generated_at", "is", null)
    .in("delivery_date", deliveryDates);
  const datesWithOrders = new Set((generated ?? []).map((o) => o.delivery_date as string));

  const candidates = reports.filter((r) => {
    const date = r.delivery_date as string;
    if (datesWithOrders.has(date)) return false;
    if (new Date(r.created_at as string).getTime() <= sendDeadlineForDelivery(date).getTime()) return false;
    return now.getTime() >= zonedInstant(productionDateForDelivery(date), GENERATION_TIME).getTime();
  });
  if (candidates.length === 0) return 0;

  const storeIds = [...new Set(candidates.map((r) => r.store_id as string))];
  const productIds = [...new Set(candidates.map((r) => r.product_id as string))];
  const { data: mins } = await admin
    .from("store_product_mins")
    .select("store_id, product_id, min_quantity")
    .in("store_id", storeIds)
    .in("product_id", productIds);
  const minByKey = new Map((mins ?? []).map((m) => [`${m.store_id}:${m.product_id}`, Number(m.min_quantity)]));

  const flagIds = candidates
    .filter((r) => {
      const min = minByKey.get(`${r.store_id}:${r.product_id}`);
      return min !== undefined && min - Number(r.quantity_reported) > 0;
    })
    .map((r) => r.id as string);
  if (flagIds.length === 0) return 0;

  await admin.from("store_stock_reports").update({ late_without_order: true }).in("id", flagIds);
  return flagIds.length;
}
