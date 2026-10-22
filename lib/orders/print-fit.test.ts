import { describe, expect, it } from "vitest";
import { sectorPrintCss, sectorPrintLayout } from "@/lib/orders/print-fit";

describe("sectorPrintLayout", () => {
  it("fits a typical sector (30 products, 18 stores) on one page at a readable size", () => {
    const layout = sectorPrintLayout(30, 18, 19);
    expect(layout.fit).toBe(true);
    expect(layout.rowMm).toBeGreaterThan(3.5);
    expect(layout.fontMm).toBeGreaterThan(2.2);
  });

  it("keeps few rows from becoming huge", () => {
    const layout = sectorPrintLayout(4, 18, 12);
    expect(layout.fit).toBe(true);
    expect(layout.rowMm).toBeLessThanOrEqual(7);
  });

  it("does not force a sector with too many products onto one page", () => {
    const layout = sectorPrintLayout(80, 18, 19);
    expect(layout.fit).toBe(false);
    expect(sectorPrintCss("s", layout)).not.toContain(".s { break-inside: avoid; }");
  });

  it("keeps the whole sector together when it fits", () => {
    expect(sectorPrintCss("sector-0", sectorPrintLayout(20, 10, 10))).toContain(".sector-0 { break-inside: avoid; }");
  });
});
