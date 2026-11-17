import { describe, expect, it } from "vitest";
import { manualEntriesToCount, nameSimilarity, suggestProductCode } from "@/lib/erp/manual-production";

const catalog = [
  { product_code: "1", display_name: "COXINHA DE FRANGO" },
  { product_code: "2", display_name: "COXINHA DE FRANGO CATUPIRY" },
  { product_code: "3", display_name: "EMPADA DE CARNE DO SOL" },
  { product_code: "4", display_name: "MOLHO TERIYAKI" },
  { product_code: "5", display_name: "CROISSANT" },
  { product_code: "6", display_name: "FRANGO EMPANADO" },
  { product_code: "7", display_name: "PÃO FRANCÊS" },
];

describe("suggestProductCode", () => {
  it("expands the schedule abbreviations", () => {
    expect(suggestProductCode("COX. FRANGO", catalog)).toBe("1");
    expect(suggestProductCode("COX. DE FRANGO CAT", catalog)).toBe("2");
    expect(suggestProductCode("EMP. DE CARNE DO SOL", catalog)).toBe("3");
  });
  it("forgives a one-letter typo", () => {
    expect(suggestProductCode("MOLHO TERYAKI", catalog)).toBe("4");
    expect(suggestProductCode("CROISSAINT", catalog)).toBe("5");
  });
  it("matches a longer schedule name that holds the whole product name", () => {
    expect(suggestProductCode("FILÉ DE FRANGO EMPANADO", catalog)).toBe("6");
  });
  it("returns null when nothing is close enough", () => {
    expect(suggestProductCode("PÃO CARIOCA", catalog)).toBeNull();
    expect(suggestProductCode("PATÊ DE ALHO", catalog)).toBeNull();
  });
  it("is symmetric", () => {
    expect(nameSimilarity("A B", "B A")).toBe(1);
  });
});

describe("manualEntriesToCount", () => {
  const manual = [
    { productCode: "1", date: "2026-11-16", quantity: 10 },
    { productCode: "2", date: "2026-11-16", quantity: 5 },
  ];
  it("keeps the manual entry until the ERP brings the same product on the same day", () => {
    const erp = [{ product_code: "1", launch_date: "2026-11-16", excluded: false }];
    expect(manualEntriesToCount(manual, erp).map((m) => m.productCode)).toEqual(["2"]);
  });
  it("ignores ERP orders that are excluded or from another day", () => {
    const erp = [
      { product_code: "1", launch_date: "2026-11-16", excluded: true },
      { product_code: "2", launch_date: "2026-11-15", excluded: false },
    ];
    expect(manualEntriesToCount(manual, erp)).toHaveLength(2);
  });
});
