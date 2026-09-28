import "server-only";
import { createClient } from "@/lib/supabase/server";
import { deadlineForDeliveryDate, defaultSendWeekday, DEFAULT_DEADLINE_TIME } from "@/lib/delivery-schedule";
import { weekdayOfISODate } from "@/lib/dates";
import type { Product, Sector, Store, StoreDeliveryDay, StoreStockReport } from "@/lib/types/database.types";

export type LateReportRow = {
  reportId: string;
  storeId: string;
  storeName: string;
  productName: string;
  unit: string;
  quantityReported: number;
  createdAt: string;
  minutesLate: number;
  sectorId: string;
  sectorName: string;
  deliveryDate: string;
};

/** Every store report flagged late (arrived after its order was already generated) and not yet decided. */
export async function getUndecidedLateReports(): Promise<LateReportRow[]> {
  const supabase = await createClient();
  const { data: late } = await supabase
    .from("store_stock_reports")
    .select("*")
    .not("late_for_order_id", "is", null)
    .eq("late_acknowledged", false)
    .order("created_at", { ascending: false });

  const rows = (late ?? []) as StoreStockReport[];
  if (rows.length === 0) return [];

  const storeIds = [...new Set(rows.map((r) => r.store_id))];
  const productIds = [...new Set(rows.map((r) => r.product_id))];

  const [{ data: stores }, { data: products }, { data: deliveryDays }] = await Promise.all([
    supabase.from("stores").select("*").in("id", storeIds),
    supabase.from("products").select("*").in("id", productIds),
    supabase.from("store_delivery_days").select("*").in("store_id", storeIds),
  ]);
  const storesById = Object.fromEntries(((stores ?? []) as Store[]).map((s) => [s.id, s]));
  const productsById = Object.fromEntries(((products ?? []) as Product[]).map((p) => [p.id, p]));

  const deliveryDaysByStore = new Map<string, StoreDeliveryDay[]>();
  for (const d of (deliveryDays ?? []) as StoreDeliveryDay[]) {
    const list = deliveryDaysByStore.get(d.store_id) ?? [];
    list.push(d);
    deliveryDaysByStore.set(d.store_id, list);
  }

  const sectorIds = [...new Set(Object.values(productsById).map((p) => p.sector_id))];
  const { data: sectors } = sectorIds.length
    ? await supabase.from("sectors").select("*").in("id", sectorIds)
    : { data: [] as Sector[] };
  const sectorsById = Object.fromEntries(((sectors ?? []) as Sector[]).map((s) => [s.id, s]));

  const result: LateReportRow[] = [];
  for (const r of rows) {
    const product = productsById[r.product_id];
    if (!product || !r.delivery_date) continue;
    const sector = sectorsById[product.sector_id];

    const weekday = weekdayOfISODate(r.delivery_date);
    const config = (deliveryDaysByStore.get(r.store_id) ?? []).find((d) => d.weekday === weekday);
    const sendWeekday = config?.send_weekday ?? defaultSendWeekday(weekday);
    const deadlineTime = config?.deadline_time?.slice(0, 5) ?? DEFAULT_DEADLINE_TIME;
    const deadline = deadlineForDeliveryDate(r.delivery_date, sendWeekday, deadlineTime);
    const minutesLate = Math.max(0, Math.round((new Date(r.created_at).getTime() - deadline.getTime()) / 60000));

    result.push({
      reportId: r.id,
      storeId: r.store_id,
      storeName: storesById[r.store_id]?.name ?? "?",
      productName: product.name,
      unit: product.unit,
      quantityReported: r.quantity_reported,
      createdAt: r.created_at,
      minutesLate,
      sectorId: product.sector_id,
      sectorName: sector?.name ?? "—",
      deliveryDate: r.delivery_date,
    });
  }
  return result;
}

export type LateReportGroup = {
  sectorId: string;
  sectorName: string;
  deliveryDate: string;
  items: LateReportRow[];
};

export function groupLateReports(rows: LateReportRow[]): LateReportGroup[] {
  const groups = new Map<string, LateReportGroup>();
  for (const row of rows) {
    const key = `${row.sectorId}:${row.deliveryDate}`;
    const group = groups.get(key) ?? {
      sectorId: row.sectorId,
      sectorName: row.sectorName,
      deliveryDate: row.deliveryDate,
      items: [],
    };
    group.items.push(row);
    groups.set(key, group);
  }
  return [...groups.values()];
}
