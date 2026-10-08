import { addDaysISO } from "@/lib/dates";

export type Holiday = { date: string; name: string };

const pad = (n: number) => String(n).padStart(2, "0");

/** Easter Sunday (Gregorian), as YYYY-MM-DD — the anchor of the movable holidays. */
function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** National holidays plus the ones that matter in Fortaleza (state and city), sorted by date. */
export function holidaysOfYear(year: number): Holiday[] {
  const easter = easterSunday(year);
  const list: Holiday[] = [
    { date: `${year}-01-01`, name: "Confraternização Universal" },
    { date: addDaysISO(easter, -47), name: "Carnaval" },
    { date: `${year}-03-25`, name: "Data Magna do Ceará" },
    { date: addDaysISO(easter, -2), name: "Sexta-feira Santa" },
    { date: `${year}-04-21`, name: "Tiradentes" },
    { date: `${year}-05-01`, name: "Dia do Trabalho" },
    { date: addDaysISO(easter, 60), name: "Corpus Christi" },
    { date: `${year}-08-15`, name: "Nossa Senhora da Assunção (Fortaleza)" },
    { date: `${year}-09-07`, name: "Independência do Brasil" },
    { date: `${year}-10-12`, name: "Nossa Senhora Aparecida (Padroeira do Brasil)" },
    { date: `${year}-11-02`, name: "Finados (Dia de Todos os Santos)" },
    { date: `${year}-11-15`, name: "Proclamação da República" },
    { date: `${year}-11-20`, name: "Consciência Negra" },
    { date: `${year}-12-25`, name: "Natal" },
  ];
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

/** The next `count` holidays from `fromISO` (inclusive), rolling into the following years when needed. */
export function upcomingHolidays(fromISO: string, count: number): Holiday[] {
  const year = Number(fromISO.slice(0, 4));
  return [...holidaysOfYear(year), ...holidaysOfYear(year + 1), ...holidaysOfYear(year + 2)]
    .filter((h) => h.date >= fromISO)
    .slice(0, count);
}
