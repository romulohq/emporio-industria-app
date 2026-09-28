import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeDayOrderPlan } from "@/lib/orders/compute-day-order-plan";
import type { Product, ProductionOrder, ProductionOrderContribution } from "@/lib/types/database.types";

export type DiffItem = {
  productId: string;
  productName: string;
  unit: string;
  responsibleId: string | null;
  before: number;
  after: number;
};

export type DayOrderDiff = {
  entering: DiffItem[];
  increasing: DiffItem[];
  decreasing: DiffItem[];
  removed: DiffItem[];
  byResponsible: Map<string, DiffItem[]>; // key = responsible_id, or "sem" for unassigned
};

/**
 * Compares the sector+date's currently-live order against what generation
 * would produce right now (optionally pretending some late reports never
 * arrived, via excludeReportIds) — without writing anything. Used to show
 * an admin what "Gerar novamente" would change before they confirm it.
 */
export async function diffDayOrders(
  sectorId: string,
  deliveryDateISO: string,
  excludeReportIds: Set<string> = new Set()
): Promise<DayOrderDiff> {
  const admin = createAdminClient();

  const { byProduct, productsById } = await computeDayOrderPlan(deliveryDateISO, { excludeReportIds });

  const { data: existingOrders } = await admin
    .from("production_orders")
    .select("*")
    .eq("sector_id", sectorId)
    .eq("delivery_date", deliveryDateISO)
    .eq("source", "auto_route")
    .in("status", ["pending", "in_progress"]);

  const currentByProduct = new Map(((existingOrders ?? []) as ProductionOrder[]).map((o) => [o.product_id, o]));

  const relevantProductIds = new Set<string>([
    ...currentByProduct.keys(),
    ...[...byProduct.keys()].filter((id) => productsById.get(id)?.sector_id === sectorId),
  ]);

  const result: DayOrderDiff = { entering: [], increasing: [], decreasing: [], removed: [], byResponsible: new Map() };

  for (const productId of relevantProductIds) {
    const product = productsById.get(productId);
    const current = currentByProduct.get(productId);
    if (!product && !current) continue;

    const before = current?.quantity ?? 0;
    const contributions = byProduct.get(productId);
    const after = contributions ? [...contributions.values()].reduce((sum, c) => sum + c.quantity, 0) : 0;

    if (before === after) continue;

    const item: DiffItem = {
      productId,
      productName: product?.name ?? "—",
      unit: product?.unit ?? "",
      responsibleId: product?.responsible_id ?? null,
      before,
      after,
    };

    if (before === 0 && after > 0) result.entering.push(item);
    else if (after === 0 && before > 0) result.removed.push(item);
    else if (after > before) result.increasing.push(item);
    else result.decreasing.push(item);

    const key = item.responsibleId ?? "sem";
    const list = result.byResponsible.get(key) ?? [];
    list.push(item);
    result.byResponsible.set(key, list);
  }

  return result;
}

export type OrderSnapshotEntry = {
  productId: string;
  quantity: number;
  contributions: { storeId: string; quantity: number; locked: boolean }[];
};

/** Captures the sector+date's current live state, to store before regenerating. */
export async function snapshotSectorDayOrders(
  sectorId: string,
  deliveryDateISO: string
): Promise<OrderSnapshotEntry[]> {
  const admin = createAdminClient();

  const { data: orders } = await admin
    .from("production_orders")
    .select("*")
    .eq("sector_id", sectorId)
    .eq("delivery_date", deliveryDateISO)
    .eq("source", "auto_route")
    .in("status", ["pending", "in_progress"]);

  const ordersList = (orders ?? []) as ProductionOrder[];
  const orderIds = ordersList.map((o) => o.id);

  const { data: contributions } = orderIds.length
    ? await admin.from("production_order_contributions").select("*").in("order_id", orderIds)
    : { data: [] as ProductionOrderContribution[] };

  const contributionsByOrder = new Map<string, ProductionOrderContribution[]>();
  for (const c of (contributions ?? []) as ProductionOrderContribution[]) {
    const list = contributionsByOrder.get(c.order_id) ?? [];
    list.push(c);
    contributionsByOrder.set(c.order_id, list);
  }

  return ordersList.map((order) => ({
    productId: order.product_id,
    quantity: order.quantity,
    contributions: (contributionsByOrder.get(order.id) ?? []).map((c) => ({
      storeId: c.store_id,
      quantity: c.quantity,
      locked: c.locked,
    })),
  }));
}

export async function getProductNamesById(productIds: string[]): Promise<Map<string, Product>> {
  const admin = createAdminClient();
  if (productIds.length === 0) return new Map();
  const { data } = await admin.from("products").select("*").in("id", productIds);
  return new Map(((data ?? []) as Product[]).map((p) => [p.id, p]));
}
