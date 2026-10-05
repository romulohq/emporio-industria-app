import { describe, expect, it } from "vitest";
import { classifyCycleReports, type CycleReportLike } from "@/lib/orders/classify-send";

const DEADLINE = new Date("2026-10-03T02:59:00Z").getTime(); // Fri 23:59 Fortaleza
const r = (id: string, createdAt: string, flagged: boolean, acknowledged = false): CycleReportLike => ({
  id,
  created_at: createdAt,
  late_for_order_id: flagged ? "order-1" : null,
  late_acknowledged: acknowledged,
});

describe("classifyCycleReports", () => {
  it("no reports -> null", () => {
    expect(classifyCycleReports([], DEADLINE, new Map())).toBeNull();
  });

  it("a report before the deadline is on time", () => {
    const c = classifyCycleReports([r("a", "2026-10-02T11:00:00Z", false)], DEADLINE, new Map());
    expect(c?.state).toBe("on_time");
  });

  it("a flagged late report nobody decided is waiting for approval", () => {
    const c = classifyCycleReports([r("a", "2026-10-04T19:56:00Z", true)], DEADLINE, new Map());
    expect(c?.state).toBe("late");
  });

  it("an approved late report counts like on time", () => {
    const c = classifyCycleReports(
      [r("a", "2026-10-04T19:56:00Z", true, true)],
      DEADLINE,
      new Map([["a", "regenerated"]])
    );
    expect(c?.state).toBe("on_time");
  });

  it("a refused late report counts as not sent", () => {
    const c = classifyCycleReports([r("a", "2026-10-04T19:56:00Z", true, true)], DEADLINE, new Map([["a", "kept"]]));
    expect(c?.state).toBe("refused");
  });

  it("waiting for approval wins over unflagged late rows (nothing to approve)", () => {
    const c = classifyCycleReports(
      [r("a", "2026-10-04T19:56:00Z", false), r("b", "2026-10-04T19:56:00Z", true)],
      DEADLINE,
      new Map()
    );
    expect(c?.state).toBe("late");
  });

  it("refused wins over unflagged late rows", () => {
    const c = classifyCycleReports(
      [r("a", "2026-10-04T19:56:00Z", false), r("b", "2026-10-04T19:56:00Z", true, true)],
      DEADLINE,
      new Map([["b", "kept"]])
    );
    expect(c?.state).toBe("refused");
  });

  it("only unflagged late rows (arrived before generation) count as sent", () => {
    const c = classifyCycleReports([r("a", "2026-10-03T08:00:00Z", false)], DEADLINE, new Map());
    expect(c?.state).toBe("on_time");
  });

  it("an on-time report wins over everything", () => {
    const c = classifyCycleReports(
      [r("a", "2026-10-04T19:56:00Z", true), r("b", "2026-10-02T11:00:00Z", false)],
      DEADLINE,
      new Map()
    );
    expect(c).toEqual({ state: "on_time", sentAt: new Date("2026-10-02T11:00:00Z").getTime() });
  });
});
