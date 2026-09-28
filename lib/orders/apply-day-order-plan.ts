import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DayOrderPlan } from "@/lib/orders/compute-day-order-plan";
import type { ProductionOrderContribution } from "@/lib/types/database.types";

/**
 * Writes a computed plan (lib/orders/compute-day-order-plan.ts) to the
 * database: creates or updates each product's auto_route order and its
 * store contributions, respecting any admin-locked contribution. Shared by
 * the daily generator and the late-report regeneration flow.
 */
export async function applyDayOrderPlan(
  deliveryDateISO: string,
  plan: DayOrderPlan,
  options: { sectorId?: string } = {}
): Promise<{ productsUpdated: number }> {
  const admin = createAdminClient();
  const { byProduct, productsById } = plan;
  let productsUpdated = 0;

  for (const productId of new Set([...byProduct.keys()])) {
    const product = productsById.get(productId);
    if (!product) continue;
    if (options.sectorId && product.sector_id !== options.sectorId) continue;

    const fresh = byProduct.get(productId) ?? new Map<string, { quantity: number; reportId: string }>();

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
    const finalStoreIds = new Set<string>([
      ...fresh.keys(),
      ...existingContributions.filter((c) => c.locked).map((c) => c.store_id),
    ]);

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
