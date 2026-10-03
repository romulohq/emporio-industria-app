import { describe, expect, it } from "vitest";
import { planRelink } from "@/lib/orders/plan-relink";

// Sat 2026-10-03 is "today"; next Monday delivery is 2026-10-05 (stock due Fri 10-02 23:59).
const TODAY = "2026-10-03";
const MONDAY = "2026-10-05";

// 08:45 Friday 02/10 in Fortaleza = 11:45 UTC
const FRIDAY_MORNING = "2026-10-02T11:45:00Z";

describe("planRelink", () => {
  it("moves a report tied to a day the store no longer has (Saturday -> added Monday)", () => {
    const plan = planRelink({
      todayISO: TODAY,
      currentWeekdays: ["monday", "friday"],
      addedWeekdays: ["monday"],
      reports: [{ id: "jacarecanga", delivery_date: "2026-10-03", created_at: FRIDAY_MORNING }],
    });
    expect(plan.get("jacarecanga")).toBe(MONDAY);
  });

  it("never steals a report still tied to a valid delivery day", () => {
    const plan = planRelink({
      todayISO: TODAY,
      currentWeekdays: ["monday", "friday"],
      addedWeekdays: ["monday"],
      reports: [{ id: "valid", delivery_date: "2026-10-09", created_at: FRIDAY_MORNING }],
    });
    expect(plan.size).toBe(0);
  });

  it("leaves reports of deliveries that already happened alone", () => {
    const plan = planRelink({
      todayISO: TODAY,
      currentWeekdays: ["monday", "friday"],
      addedWeekdays: ["monday"],
      reports: [{ id: "past", delivery_date: "2026-10-02", created_at: "2026-10-01T10:00:00Z" }],
    });
    expect(plan.size).toBe(0);
  });

  it("ignores reports sent before the previous cycle's production day ended", () => {
    const plan = planRelink({
      todayISO: TODAY,
      currentWeekdays: ["monday"],
      addedWeekdays: ["monday"],
      // previous Monday (09-28) was produced Saturday 09-26; this was sent Friday 09-25
      reports: [{ id: "stale", delivery_date: "2026-10-03", created_at: "2026-09-25T12:00:00Z" }],
    });
    expect(plan.size).toBe(0);
  });

  it("a report sent after the new deadline is still re-attached (it will show as late)", () => {
    const plan = planRelink({
      todayISO: TODAY,
      currentWeekdays: ["monday"],
      addedWeekdays: ["monday"],
      // Saturday 08:00 Fortaleza — after Friday 23:59
      reports: [{ id: "late", delivery_date: "2026-10-03", created_at: "2026-10-03T11:00:00Z" }],
    });
    expect(plan.get("late")).toBe(MONDAY);
  });

  it("with several added weekdays, attaches to the earliest delivery it can belong to", () => {
    const plan = planRelink({
      todayISO: TODAY,
      currentWeekdays: ["monday", "wednesday"],
      addedWeekdays: ["wednesday", "monday"],
      reports: [{ id: "r", delivery_date: "2026-10-03", created_at: FRIDAY_MORNING }],
    });
    expect(plan.get("r")).toBe(MONDAY);
  });

  it("ignores legacy reports without a delivery date", () => {
    const plan = planRelink({
      todayISO: TODAY,
      currentWeekdays: ["monday"],
      addedWeekdays: ["monday"],
      reports: [{ id: "legacy", delivery_date: null, created_at: FRIDAY_MORNING }],
    });
    expect(plan.size).toBe(0);
  });
});
