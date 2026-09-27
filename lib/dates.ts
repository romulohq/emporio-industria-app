import type { Weekday } from "@/lib/types/database.types";

const TIME_ZONE = "America/Sao_Paulo";

const WEEKDAY_BY_JS_INDEX: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/** Today (or today + offsetDays) as YYYY-MM-DD in the America/Sao_Paulo timezone. */
export function saoPauloDateISO(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

/** Weekday of a YYYY-MM-DD date, computed at noon UTC to avoid timezone rollover. */
export function weekdayOfISODate(dateISO: string): Weekday {
  const [year, month, day] = dateISO.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return WEEKDAY_BY_JS_INDEX[date.getUTCDay()];
}

/** Formats a YYYY-MM-DD date as dd/mm for display. */
export function formatBrDate(dateISO: string): string {
  const [, month, day] = dateISO.split("-");
  return `${day}/${month}`;
}
