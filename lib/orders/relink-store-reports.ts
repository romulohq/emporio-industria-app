import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fortalezaDateISO, zonedInstant, addDaysISO } from "@/lib/dates";
import { nextDeliveryDate, productionDateForDelivery, SEND_DEADLINE_TIME } from "@/lib/delivery-schedule";
import { planRelink } from "@/lib/orders/plan-relink";
import type {
  Product,
  ProductionOrder,
  ProductionOrderContribution,
  StoreProductMin,
  StoreStockReport,
  Weekday,
} from "@/lib/types/database.types";

export type WeekdayAddition = { storeId: string; weekday: Weekday };

/**
 * Keeps store schedules and store reports linked: for each store added to a
 * delivery weekday, finds its already-sent "orphan" reports (see planRelink)
 * and attaches them to that weekday's next delivery, so the send status
 * (on time / late) is judged against the new deadline. If that delivery's
 * order was already generated and doesn't use the report, it is flagged as a
 * late report — the same alert/decision flow as any report that arrives
 * after its order was frozen.
 */
export async function relinkStoreReports(additions: WeekdayAddition[]): Promise<{ relinked: number; flagged: number }> {
  if (additions.length === 0) return { relinked: 0, flagged: 0 };
  const admin = createAdminClient();
  const todayISO = fortalezaDateISO();

  const byStore = new Map<string, Weekday[]>();
  for (const a of additions) byStore.set(a.storeId, [...(byStore.get(a.storeId) ?? []), a.weekday]);

  const relinkedRows: { report: StoreStockReport; deliveryDate: string }[] = [];

  for (const [storeId, addedWeekdays] of byStore) {
    const { data: days } = await admin.from("store_delivery_days").select("weekday").eq("store_id", storeId);
    const currentWeekdays = (days ?? []).map((d) => d.weekday as Weekday);

    // widest window any addition could need: since the earliest previous production day
    const earliestTarget = addedWeekdays.map((w) => nextDeliveryDate(todayISO, w)).sort()[0];
    const windowStart = zonedInstant(
      productionDateForDelivery(addDaysISO(earliestTarget, -7)),
      SEND_DEADLINE_TIME
    );

    const { data: reports } = await admin
      .from("store_stock_reports")
      .select("*")
      .eq("store_id", storeId)
      .gte("delivery_date", todayISO)
      .gt("created_at", windowStart.toISOString());

    const plan = planRelink({
      todayISO,
      currentWeekdays,
      addedWeekdays,
      reports: ((reports ?? []) as StoreStockReport[]).map((r) => ({
        id: r.id,
        delivery_date: r.delivery_date,
        created_at: r.created_at,
      })),
    });

    for (const report of (reports ?? []) as StoreStockReport[]) {
      const deliveryDate = plan.get(report.id);
      if (!deliveryDate) continue;
      await admin
        .from("store_stock_reports")
        .update({ delivery_date: deliveryDate, late_for_order_id: null, late_acknowledged: false })
        .eq("id", report.id);
      relinkedRows.push({ report, deliveryDate });
    }
  }

  const flagged = await flagReportsMissingFromGeneratedOrders(relinkedRows);
  return { relinked: relinkedRows.length, flagged };
}

async function flagReportsMissingFromGeneratedOrders(
  rows: { report: StoreStockReport; deliveryDate: string }[]
): Promise<number> {
  if (rows.length === 0) return 0;
  const admin = createAdminClient();

  const deliveryDates = [...new Set(rows.map((r) => r.deliveryDate))];
  const productIds = [...new Set(rows.map((r) => r.report.product_id))];
  const storeIds = [...new Set(rows.map((r) => r.report.store_id))];

  const { data: orders } = await admin
    .from("production_orders")
    .select("*")
    .eq("source", "auto_route")
    .in("status", ["pending", "in_progress"])
    .not("generated_at", "is", null)
    .in("delivery_date", deliveryDates);
  const ordersList = (orders ?? []) as ProductionOrder[];
  if (ordersList.length === 0) return 0;

  const [{ data: contributions }, { data: mins }] = await Promise.all([
    admin.from("production_order_contributions").select("*").in("order_id", ordersList.map((o) => o.id)).in("store_id", storeIds),
    admin.from("store_product_mins").select("*").in("store_id", storeIds).in("product_id", productIds),
  ]);
  const contributionByKey = new Map(
    ((contributions ?? []) as ProductionOrderContribution[]).map((c) => [`${c.order_id}:${c.store_id}`, c])
  );
  const minByKey = new Map(
    ((mins ?? []) as StoreProductMin[]).map((m) => [`${m.store_id}:${m.product_id}`, m.min_quantity])
  );

  let flagged = 0;
  for (const { report, deliveryDate } of rows) {
    // a product with no order yet still counts when its delivery was already generated: the
    // report would add one, so it needs review (same rule as the database trigger)
    const productOrder = ordersList.find((o) => o.delivery_date === deliveryDate && o.product_id === report.product_id);
    const order = productOrder ?? ordersList.find((o) => o.delivery_date === deliveryDate);
    if (!order) continue;

    const contribution = productOrder ? contributionByKey.get(`${order.id}:${report.store_id}`) : undefined;
    if (contribution?.report_id === report.id) continue; // the order already uses this very report

    const min = minByKey.get(`${report.store_id}:${report.product_id}`);
    if (min === undefined) continue;
    const deficit = Math.max(0, Math.round((min - report.quantity_reported) * 1000) / 1000);
    if ((contribution?.quantity ?? 0) === deficit) continue; // would not change the order

    await admin.from("store_stock_reports").update({ late_for_order_id: order.id }).eq("id", report.id);
    flagged += 1;
  }
  return flagged;
}

/**
 * After an admin applies a route-change review (which regenerates the order
 * with every current report), the late alerts it raised for the same
 * sector/delivery date are settled too — otherwise they would linger.
 */
export async function acknowledgeLateReportsForRegeneration(
  sectorId: string,
  deliveryDate: string,
  decidedBy: string
): Promise<void> {
  const admin = createAdminClient();
  const { data: late } = await admin
    .from("store_stock_reports")
    .select("id, product_id")
    .eq("delivery_date", deliveryDate)
    .not("late_for_order_id", "is", null)
    .eq("late_acknowledged", false);
  if (!late?.length) return;

  const { data: products } = await admin
    .from("products")
    .select("id, sector_id")
    .in("id", [...new Set(late.map((r) => r.product_id as string))]);
  const sectorByProduct = new Map(((products ?? []) as Pick<Product, "id" | "sector_id">[]).map((p) => [p.id, p.sector_id]));
  const ids = late.filter((r) => sectorByProduct.get(r.product_id as string) === sectorId).map((r) => r.id as string);
  if (ids.length === 0) return;

  await admin.from("late_report_decisions").insert(
    ids.map((report_id) => ({
      report_id,
      sector_id: sectorId,
      delivery_date: deliveryDate,
      decision: "regenerated" as const,
      decided_by: decidedBy,
    }))
  );
  await admin.from("store_stock_reports").update({ late_acknowledged: true }).in("id", ids);
}
