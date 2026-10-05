import { describe, expect, it } from "vitest";
import { coverageOf, stockUnits } from "@/lib/stock/coverage";

describe("coverageOf", () => {
  it("at or above the minimum is ok", () => {
    expect(coverageOf(100, 100).level).toBe("ok");
    expect(coverageOf(150, 100)).toMatchObject({ level: "ok", missing: 0 });
  });
  it("between half and the minimum is a warning", () => {
    expect(coverageOf(50, 100)).toMatchObject({ level: "warn", missing: 50 });
    expect(coverageOf(99, 100).level).toBe("warn");
  });
  it("below half is low", () => {
    expect(coverageOf(49, 100)).toMatchObject({ level: "low", missing: 51 });
    expect(coverageOf(0, 100).level).toBe("low");
  });
  it("no minimum means no judgement", () => {
    expect(coverageOf(5, 0)).toMatchObject({ level: "none", ratio: null });
  });
});

describe("stockUnits", () => {
  it("is boxes times units per box, rounded", () => {
    expect(stockUnits(6, 120)).toBe(720);
    expect(stockUnits(0.5, 20)).toBe(10);
  });
});
