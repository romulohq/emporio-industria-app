import { addDaysISO, weekdayOfISODate, zonedInstant } from "@/lib/dates";
import { nextDeliveryDate, productionDateForDelivery, SEND_DEADLINE_TIME } from "@/lib/delivery-schedule";
import type { Weekday } from "@/lib/types/database.types";

export type RelinkCandidate = { id: string; delivery_date: string | null; created_at: string };

/**
 * When a store is added to a delivery weekday, decides which of its already
 * sent reports belong to that weekday's next delivery. Only "orphan" reports
 * are moved: not yet delivered (delivery today or later) and pointing to a
 * weekday the store no longer has — a report still tied to a valid delivery
 * day is never stolen. A report must also have been sent after the previous
 * occurrence's production day ended, i.e. within this cycle's window.
 * Returns report id -> new delivery date.
 */
export function planRelink(params: {
  todayISO: string;
  currentWeekdays: Weekday[];
  addedWeekdays: Weekday[];
  reports: RelinkCandidate[];
}): Map<string, string> {
  const { todayISO, currentWeekdays, addedWeekdays, reports } = params;
  const targets = addedWeekdays.map((weekday) => nextDeliveryDate(todayISO, weekday)).sort();

  const orphans = reports.filter(
    (r) =>
      r.delivery_date !== null &&
      r.delivery_date >= todayISO &&
      !currentWeekdays.includes(weekdayOfISODate(r.delivery_date))
  );

  const result = new Map<string, string>();
  for (const report of orphans) {
    const target = targets.find((deliveryDate) => {
      const windowStart = zonedInstant(
        productionDateForDelivery(addDaysISO(deliveryDate, -7)),
        SEND_DEADLINE_TIME
      );
      return report.delivery_date! < deliveryDate && new Date(report.created_at).getTime() > windowStart.getTime();
    });
    if (target) result.set(report.id, target);
  }
  return result;
}
