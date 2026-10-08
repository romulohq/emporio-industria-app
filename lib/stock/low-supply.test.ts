import { describe, expect, it } from "vitest";
import { latestCountByProduct, productsRunningLow } from "@/lib/stock/low-supply";

const product = (id: string, min: number) => ({ id, name: id.toUpperCase(), unit: "und", min_quantity: min });

describe("latestCountByProduct", () => {
  it("keeps the most recent count of each product", () => {
    const latest = latestCountByProduct([
      { product_id: "a", count_date: "2026-10-05", stock_units: 10 },
      { product_id: "a", count_date: "2026-10-07", stock_units: 40 },
      { product_id: "a", count_date: "2026-10-06", stock_units: 20 },
    ]);
    expect(latest.get("a")?.stock_units).toBe(40);
  });
});

describe("productsRunningLow", () => {
  const latest = latestCountByProduct([
    { product_id: "low", count_date: "2026-10-07", stock_units: 10 }, // 10% of 100
    { product_id: "edge", count_date: "2026-10-07", stock_units: 20 }, // exactly 20%
    { product_id: "ok", count_date: "2026-10-07", stock_units: 90 },
    { product_id: "empty", count_date: "2026-10-07", stock_units: 0 },
    { product_id: "nomin", count_date: "2026-10-07", stock_units: 0 },
  ]);
  const products = [product("low", 100), product("edge", 100), product("ok", 100), product("empty", 50), product("nomin", 0), product("never", 100)];

  it("lists only products under 20%, most critical first", () => {
    expect(productsRunningLow(products, latest).map((p) => p.id)).toEqual(["empty", "low"]);
  });

  it("does not judge products never counted or without a minimum", () => {
    const ids = productsRunningLow(products, latest).map((p) => p.id);
    expect(ids).not.toContain("never");
    expect(ids).not.toContain("nomin");
  });

  it("20% exactly is not under the threshold", () => {
    expect(productsRunningLow(products, latest).map((p) => p.id)).not.toContain("edge");
  });
});
