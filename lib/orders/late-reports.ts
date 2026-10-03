import "server-only";
import { createClient } from "@/lib/supabase/server";
import { sendDeadlineForDelivery } from "@/lib/delivery-schedule";
import { fortalezaDateISO } from "@/lib/dates";
import type { Product, Sector, Store, StoreStockReport } from "@/lib/types/database.types";

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

/**
 * Every store report flagged late (arrived after its order was already generated) and not yet
 * decided, for a delivery that's still the current actionable cycle (matches the same
 * `delivery_date > hoje` cutoff as the "Pedidos — por dia" screen — once a delivery date has
 * arrived, that order has moved to Histórico and re-litigating it no longer helps).
 */
export async function getUndecidedLateReports(): Promise<LateReportRow[]> {
  const supabase = await createClient();
  const { data: late } = await supabase
    .from("store_stock_reports")
    .select("*")
    .not("late_for_order_id", "is", null)
    .eq("late_acknowledged", false)
    .gt("delivery_date", fortalezaDateISO())
    .order("created_at", { ascending: false });

  const rows = (late ?? []) as StoreStockReport[];
  if (rows.length === 0) return [];

  const storeIds = [...new Set(rows.map((r) => r.store_id))];
  const productIds = [...new Set(rows.map((r) => r.product_id))];

  const [{ data: stores }, { data: products }] = await Promise.all([
    supabase.from("stores").select("*").in("id", storeIds),
    supabase.from("products").select("*").in("id", productIds),
  ]);
  const storesById = Object.fromEntries(((stores ?? []) as Store[]).map((s) => [s.id, s]));
  const productsById = Object.fromEntries(((products ?? []) as Product[]).map((p) => [p.id, p]));

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

    const deadline = sendDeadlineForDelivery(r.delivery_date);
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
