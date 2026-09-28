import type { Weekday } from "@/lib/types/database.types";

const TIME_ZONE = "America/Fortaleza";
// Brazil has had no daylight saving time since 2019, so this offset is fixed year-round.
const UTC_OFFSET = "-03:00";

const WEEKDAY_BY_JS_INDEX: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/** Formats an arbitrary instant as YYYY-MM-DD in the America/Fortaleza timezone. */
export function dateToFortalezaISO(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);
}

/** Today (or today + offsetDays) as YYYY-MM-DD in the America/Fortaleza timezone. */
export function fortalezaDateISO(offsetDays = 0): string {
  return dateToFortalezaISO(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000));
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

/** Adds (or subtracts) whole days to a YYYY-MM-DD date, returning YYYY-MM-DD. */
export function addDaysISO(dateISO: string, days: number): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return date.toISOString().slice(0, 10);
}

/** Combines a YYYY-MM-DD date and an "HH:MM" time into the exact instant in America/Fortaleza. */
export function zonedInstant(dateISO: string, time: string): Date {
  const hhmm = time.length === 5 ? time : time.slice(0, 5);
  return new Date(`${dateISO}T${hhmm}:00${UTC_OFFSET}`);
}
