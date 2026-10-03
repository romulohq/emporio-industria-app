import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { diffDayOrders, type DayOrderDiff } from "@/lib/orders/diff-day-orders";
import { nextDeliveryDate } from "@/lib/delivery-schedule";
import { fortalezaDateISO } from "@/lib/dates";
import type { Weekday } from "@/lib/types/database.types";

export function hasDiffChanges(diff: DayOrderDiff): boolean {
  return diff.entering.length + diff.increasing.length + diff.decreasing.length + diff.removed.length > 0;
}

/**
 * For each weekday whose store membership just changed, checks the next
 * delivery date for that weekday: if an order was already generated for it,
 * and recalculating it right now would actually change something, it's
 * returned as a group needing admin review before being applied. A
 * date/sector with nothing generated yet has nothing to protect — the next
 * regular generation will simply pick up the new schedule on its own.
 */
export async function computeRouteScheduleImpact(
  changedWeekdays: Set<Weekday>
): Promise<{ sectorId: string; deliveryDate: string }[]> {
  if (changedWeekdays.size === 0) return [];
  const admin = createAdminClient();
  const todayISO = fortalezaDateISO();

  const dates = [...new Set([...changedWeekdays].map((w) => nextDeliveryDate(todayISO, w)))];

  const groups: { sectorId: string; deliveryDate: string }[] = [];
  for (const deliveryDate of dates) {
    const { data: orders } = await admin
      .from("production_orders")
      .select("sector_id")
      .eq("delivery_date", deliveryDate)
      .eq("source", "auto_route")
      .in("status", ["pending", "in_progress"]);
    const sectorIds = [...new Set((orders ?? []).map((o) => o.sector_id as string))];

    for (const sectorId of sectorIds) {
      const diff = await diffDayOrders(sectorId, deliveryDate);
      if (hasDiffChanges(diff)) groups.push({ sectorId, deliveryDate });
    }
  }
  return groups;
}
