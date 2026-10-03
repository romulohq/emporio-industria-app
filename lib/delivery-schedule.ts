import { addDaysISO, dateToFortalezaISO, weekdayOfISODate, zonedInstant } from "@/lib/dates";
import { WEEKDAY_ORDER } from "@/lib/format/labels";
import type { Weekday } from "@/lib/types/database.types";

/**
 * Single source of truth for the delivery / production / stock-report timing
 * rule. Everything is derived from the delivery date D:
 *
 *   production day = D-1, except there is no production on Sunday, so a
 *                    Monday delivery is produced on Saturday morning (D-2)
 *   send deadline  = the day before the production day, at 23:59
 *                    (America/Fortaleza, never UTC)
 *   order generated = on the production day
 */
export const SEND_DEADLINE_TIME = "23:59";

const NO_PRODUCTION_WEEKDAY: Weekday = "sunday";

function weekdayIndex(weekday: Weekday): number {
  return WEEKDAY_ORDER.indexOf(weekday);
}

/** The day the order is generated and the production happens for a delivery date. */
export function productionDateForDelivery(deliveryDateISO: string): string {
  const dayBefore = addDaysISO(deliveryDateISO, -1);
  return weekdayOfISODate(dayBefore) === NO_PRODUCTION_WEEKDAY ? addDaysISO(dayBefore, -1) : dayBefore;
}

/** The last day (until 23:59) a store may send its stock report for a delivery date. */
export function sendDeadlineDateForDelivery(deliveryDateISO: string): string {
  return addDaysISO(productionDateForDelivery(deliveryDateISO), -1);
}

/** The exact submission deadline instant (23:59 America/Fortaleza) for a delivery date. */
export function sendDeadlineForDelivery(deliveryDateISO: string): Date {
  return zonedInstant(sendDeadlineDateForDelivery(deliveryDateISO), SEND_DEADLINE_TIME);
}

/** Weekday-level view of the same rule, for screens that only know a store's delivery weekday. */
export function productionWeekdayForDelivery(deliveryWeekday: Weekday): Weekday {
  let index = (weekdayIndex(deliveryWeekday) - 1 + 7) % 7;
  if (WEEKDAY_ORDER[index] === NO_PRODUCTION_WEEKDAY) index = (index - 1 + 7) % 7;
  return WEEKDAY_ORDER[index];
}

export function sendWeekdayForDelivery(deliveryWeekday: Weekday): Weekday {
  const productionIndex = weekdayIndex(productionWeekdayForDelivery(deliveryWeekday));
  return WEEKDAY_ORDER[(productionIndex - 1 + 7) % 7];
}

/** Delivery dates whose orders are generated (and produced) on `productionDateISO`. */
export function deliveryDatesProducedOn(productionDateISO: string): string[] {
  return [1, 2]
    .map((offset) => addDaysISO(productionDateISO, offset))
    .filter((deliveryDate) => productionDateForDelivery(deliveryDate) === productionDateISO);
}

/** Future deliveries whose production day has already started (today or earlier). */
export function deliveryDatesInProduction(todayISO: string): string[] {
  return [1, 2]
    .map((offset) => addDaysISO(todayISO, offset))
    .filter((deliveryDate) => productionDateForDelivery(deliveryDate) <= todayISO);
}

/** Next date, strictly after today, that falls on `weekday` — a report is always prep for a future delivery. */
export function nextDeliveryDate(todayISO: string, weekday: Weekday): string {
  const diff = (weekdayIndex(weekday) - weekdayIndex(weekdayOfISODate(todayISO)) + 7) % 7 || 7;
  return addDaysISO(todayISO, diff);
}

export type CurrentCycle = {
  deliveryDate: string;
  deliveryWeekday: Weekday;
  productionDate: string;
  sendDate: string;
  sendWeekday: Weekday;
  deadlineTime: string;
  deadline: Date;
};

/**
 * Picks the store's currently-open delivery cycle: among its delivery
 * weekdays, the one whose delivery date is soonest (strictly after today). A
 * submission still targets that cycle even if its deadline has passed — it is
 * simply late, not attributed to next week's occurrence. Returns null if the
 * store has no delivery days configured.
 */
export function computeCurrentCycle(deliveryWeekdays: Weekday[], now: Date = new Date()): CurrentCycle | null {
  const todayISO = dateToFortalezaISO(now);
  const deliveryDates = deliveryWeekdays.map((weekday) => nextDeliveryDate(todayISO, weekday));
  if (deliveryDates.length === 0) return null;

  const deliveryDate = deliveryDates.sort()[0];
  const sendDate = sendDeadlineDateForDelivery(deliveryDate);

  return {
    deliveryDate,
    deliveryWeekday: weekdayOfISODate(deliveryDate),
    productionDate: productionDateForDelivery(deliveryDate),
    sendDate,
    sendWeekday: weekdayOfISODate(sendDate),
    deadlineTime: SEND_DEADLINE_TIME,
    deadline: sendDeadlineForDelivery(deliveryDate),
  };
}
