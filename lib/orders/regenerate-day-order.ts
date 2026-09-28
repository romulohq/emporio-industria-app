import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeDayOrderPlan } from "@/lib/orders/compute-day-order-plan";
import { applyDayOrderPlan } from "@/lib/orders/apply-day-order-plan";
import { snapshotSectorDayOrders } from "@/lib/orders/diff-day-orders";
import type { ProductionOrder } from "@/lib/types/database.types";

/**
 * Regenerates one sector's day order after an admin reviews late reports and
 * decides to include them — never automatic. Snapshots the current state
 * first (so the previous version stays inspectable) and bumps a shared
 * current_version label across every order in that (sector, delivery_date)
 * batch, whether or not each individual product actually changed.
 */
export async function regenerateSectorDayOrder(
  sectorId: string,
  deliveryDateISO: string,
  excludeReportIds: Set<string>,
  reason: string | null,
  triggeredBy: string | null
): Promise<{ versionNumber: number; productsUpdated: number }> {
  const admin = createAdminClient();

  const [snapshot, { data: existingOrders }] = await Promise.all([
    snapshotSectorDayOrders(sectorId, deliveryDateISO),
    admin
      .from("production_orders")
      .select("*")
      .eq("sector_id", sectorId)
      .eq("delivery_date", deliveryDateISO)
      .eq("source", "auto_route")
      .in("status", ["pending", "in_progress"]),
  ]);

  const currentMaxVersion = ((existingOrders ?? []) as ProductionOrder[]).reduce(
    (max, o) => Math.max(max, o.current_version ?? 1),
    1
  );
  const newVersion = currentMaxVersion + 1;

  await admin.from("order_regenerations").insert({
    sector_id: sectorId,
    delivery_date: deliveryDateISO,
    version_number: newVersion,
    reason,
    triggered_by: triggeredBy,
    snapshot,
  });

  const plan = await computeDayOrderPlan(deliveryDateISO, { excludeReportIds });
  const { productsUpdated } = await applyDayOrderPlan(deliveryDateISO, plan, { sectorId });

  await admin
    .from("production_orders")
    .update({ current_version: newVersion })
    .eq("sector_id", sectorId)
    .eq("delivery_date", deliveryDateISO)
    .eq("source", "auto_route")
    .in("status", ["pending", "in_progress"]);

  return { versionNumber: newVersion, productsUpdated };
}
