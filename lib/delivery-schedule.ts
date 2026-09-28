import { dateToFortalezaISO, weekdayOfISODate, addDaysISO, zonedInstant } from "@/lib/dates";
import { WEEKDAY_ORDER } from "@/lib/format/labels";
import type { Weekday } from "@/lib/types/database.types";

export const DEFAULT_DEADLINE_TIME = "23:59";
export const DEFAULT_SEND_GAP_DAYS = 2;

function weekdayIndex(weekday: Weekday): number {
  return WEEKDAY_ORDER.indexOf(weekday);
}

/** The store's default send weekday for a delivery weekday: 2 days before. */
export function defaultSendWeekday(deliveryWeekday: Weekday): Weekday {
  const index = (weekdayIndex(deliveryWeekday) - DEFAULT_SEND_GAP_DAYS + 7) % 7;
  return WEEKDAY_ORDER[index];
}

/** Next occurrence of `weekday` that is strictly after today — a submission is
 * always prep for a future delivery, never today's own (already in motion). */
function nextOccurrenceOnOrAfter(todayISO: string, weekday: Weekday): string {
  const todayWeekday = weekdayOfISODate(todayISO);
  let diff = (weekdayIndex(weekday) - weekdayIndex(todayWeekday) + 7) % 7;
  if (diff < 1) diff += 7;
  return addDaysISO(todayISO, diff);
}

/** The send date aligned to a delivery date, given the configured send weekday. */
function alignedSendDate(deliveryDateISO: string, sendWeekday: Weekday): string {
  const deliveryWeekday = weekdayOfISODate(deliveryDateISO);
  const gap = (weekdayIndex(deliveryWeekday) - weekdayIndex(sendWeekday) + 7) % 7;
  return addDaysISO(deliveryDateISO, -gap);
}

export type DeliveryDeadlineConfig = {
  weekday: Weekday;
  sendWeekday: Weekday;
  deadlineTime: string;
};

export type CurrentCycle = {
  deliveryDate: string;
  deliveryWeekday: Weekday;
  sendDate: string;
  sendWeekday: Weekday;
  deadlineTime: string;
  deadline: Date;
};

/**
 * Picks the store's currently-open delivery cycle: among all configured
 * delivery weekdays, the one whose delivery date is soonest (today or
 * later). A submission still targets that same cycle even if its deadline
 * has already passed — it's simply late, not attributed to next week's
 * occurrence instead (a late report for Friday's delivery, submitted
 * Thursday morning, still counts for THIS Friday). Returns null if the
 * store has no delivery days configured.
 */
export function computeCurrentCycle(
  configs: DeliveryDeadlineConfig[],
  now: Date = new Date()
): CurrentCycle | null {
  const todayISO = dateToFortalezaISO(now);
  let best: CurrentCycle | null = null;

  for (const config of configs) {
    const deliveryDate = nextOccurrenceOnOrAfter(todayISO, config.weekday);
    const sendDate = alignedSendDate(deliveryDate, config.sendWeekday);
    const deadline = zonedInstant(sendDate, config.deadlineTime);

    if (!best || deliveryDate < best.deliveryDate) {
      best = {
        deliveryDate,
        deliveryWeekday: config.weekday,
        sendDate,
        sendWeekday: config.sendWeekday,
        deadlineTime: config.deadlineTime,
        deadline,
      };
    }
  }

  return best;
}

/** Whether `submittedAt` came in after the cycle's own deadline. */
export function isLateForCycle(cycle: CurrentCycle, submittedAt: Date): boolean {
  return submittedAt.getTime() > cycle.deadline.getTime();
}
