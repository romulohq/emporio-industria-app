import { describe, expect, it } from "vitest";
import { holidaysOfYear, upcomingHolidays } from "@/lib/holidays";

describe("movable holidays follow Easter", () => {
  it("2026: Easter is April 5", () => {
    const byName = Object.fromEntries(holidaysOfYear(2026).map((h) => [h.name, h.date]));
    expect(byName["Sexta-feira Santa"]).toBe("2026-04-03");
    expect(byName["Carnaval"]).toBe("2026-02-17");
    expect(byName["Corpus Christi"]).toBe("2026-06-04");
  });

  it("2027: Easter is March 28", () => {
    const byName = Object.fromEntries(holidaysOfYear(2027).map((h) => [h.name, h.date]));
    expect(byName["Sexta-feira Santa"]).toBe("2027-03-26");
    expect(byName["Carnaval"]).toBe("2027-02-09");
  });
});

describe("upcomingHolidays", () => {
  it("lists the next ones in order from a given day", () => {
    expect(upcomingHolidays("2026-10-08", 3).map((h) => h.date)).toEqual(["2026-10-12", "2026-11-02", "2026-11-15"]);
  });

  it("includes the day itself", () => {
    expect(upcomingHolidays("2026-10-12", 1)[0].date).toBe("2026-10-12");
  });

  it("rolls into the next year", () => {
    const next = upcomingHolidays("2026-12-26", 2);
    expect(next[0].date).toBe("2027-01-01");
    expect(next[1].date).toBe("2027-02-09");
  });
});
