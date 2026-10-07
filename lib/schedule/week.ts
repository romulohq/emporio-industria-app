import { addDaysISO, weekdayOfISODate } from "@/lib/dates";
import type { Weekday } from "@/lib/types/database.types";

export const SCHEDULE_SECTIONS = [
  { key: "salgados", label: "Salgados máquina" },
  { key: "folheados", label: "Folheados" },
  { key: "paes", label: "Pão grupo" },
  { key: "cozinha", label: "Cozinha" },
] as const;

export type ScheduleSection = (typeof SCHEDULE_SECTIONS)[number]["key"];

/** Actions offered for a day, as used in the factory's sheet; anything else can be typed freely. */
export const SCHEDULE_ACTIONS = [
  "Produzir",
  "2x Produzir",
  "Pré-preparo",
  "Marinar",
  "Empacotar",
  "Assar",
  "Descongelar",
  "Cortar",
  "Empanar",
  "Selar",
] as const;

export const SCHEDULE_WEEKDAYS = [
  { n: 1, label: "Segunda" },
  { n: 2, label: "Terça" },
  { n: 3, label: "Quarta" },
  { n: 4, label: "Quinta" },
  { n: 5, label: "Sexta" },
] as const;

const OFFSET_FROM_MONDAY: Record<Weekday, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

/** The Monday of the week that contains `dateISO`. */
export function weekStartOf(dateISO: string): string {
  return addDaysISO(dateISO, -OFFSET_FROM_MONDAY[weekdayOfISODate(dateISO)]);
}

/** Week shown by default: this week, or the coming one on Saturday/Sunday (the week is over). */
export function defaultWeekStart(todayISO: string): string {
  const weekday = weekdayOfISODate(todayISO);
  const monday = weekStartOf(todayISO);
  return weekday === "saturday" || weekday === "sunday" ? addDaysISO(monday, 7) : monday;
}

/** Monday to Friday of the week starting at `weekStart`. */
export function weekDatesOf(weekStart: string): string[] {
  return [0, 1, 2, 3, 4].map((offset) => addDaysISO(weekStart, offset));
}

export type LabelTone = "produce" | "prep" | "thaw" | "free";

export function labelTone(label: string): LabelTone {
  const l = label.trim().toLowerCase();
  if (l.includes("produzir")) return "produce";
  if (l.includes("descongelar")) return "thaw";
  if (SCHEDULE_ACTIONS.some((a) => a.toLowerCase() === l) || l.includes("preparo")) return "prep";
  return "free";
}
