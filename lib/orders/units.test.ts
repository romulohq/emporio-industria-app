import { describe, expect, it } from "vitest";
import { OSORIO_ORDERS, RUI_ORDERS, orderUnitOf } from "@/lib/orders/units";

describe("orderUnitOf", () => {
  it("uses the order unit (pct) when the product has one", () => {
    expect(orderUnitOf({ unit: "kg", order_unit: "pct" })).toBe("pct");
  });
  it("falls back to the product unit when there is none (every Rui product)", () => {
    expect(orderUnitOf({ unit: "und", order_unit: null })).toBe("und");
    expect(orderUnitOf({ unit: "und" })).toBe("und");
    expect(orderUnitOf({ unit: "und", order_unit: "  " })).toBe("und");
  });
});

describe("orders contexts", () => {
  it("keeps the Rui screens where they were", () => {
    expect(RUI_ORDERS.basePath).toBe("/pedidos");
    expect(RUI_ORDERS.storePickerPath).toBe("/relatar-estoque");
    expect(RUI_ORDERS.bySector).toBe(true);
  });
  it("puts the Osório screens and link under their own addresses, without the sector split", () => {
    expect(OSORIO_ORDERS.basePath).toBe("/pedidos-osorio");
    expect(OSORIO_ORDERS.storePickerPath).toBe("/relatar-estoque/osorio");
    expect(OSORIO_ORDERS.bySector).toBe(false);
  });
});
