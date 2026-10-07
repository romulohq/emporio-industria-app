import { describe, expect, it } from "vitest";
import { defaultWeekStart, labelTone, weekDatesOf, weekStartOf } from "@/lib/schedule/week";

// 2026-10-05 is a Monday
describe("weekStartOf", () => {
  it("returns the Monday of any day in the week", () => {
    expect(weekStartOf("2026-10-05")).toBe("2026-10-05");
    expect(weekStartOf("2026-10-07")).toBe("2026-10-05");
    expect(weekStartOf("2026-10-09")).toBe("2026-10-05");
    expect(weekStartOf("2026-10-11")).toBe("2026-10-05");
  });
});

describe("defaultWeekStart", () => {
  it("weekdays show the current week", () => {
    expect(defaultWeekStart("2026-10-07")).toBe("2026-10-05");
  });
  it("weekend rolls over to the coming week", () => {
    expect(defaultWeekStart("2026-10-10")).toBe("2026-10-12");
    expect(defaultWeekStart("2026-10-11")).toBe("2026-10-12");
  });
});

describe("weekDatesOf", () => {
  it("lists Monday to Friday", () => {
    expect(weekDatesOf("2026-10-05")).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
    ]);
  });
  it("crosses a month boundary", () => {
    expect(weekDatesOf("2026-09-28")[4]).toBe("2026-10-02");
  });
});

describe("labelTone", () => {
  it("classifies the sheet's vocabulary", () => {
    expect(labelTone("Produzir")).toBe("produce");
    expect(labelTone("2X PRODUZIR")).toBe("produce");
    expect(labelTone("Descongelar")).toBe("thaw");
    expect(labelTone("Marinar")).toBe("prep");
    expect(labelTone("-PRE-PREPARO")).toBe("prep");
    expect(labelTone("40 KG")).toBe("free");
  });
});
