import { describe, expect, it } from "vitest";
import { LIST_AVAILABLE_MM, countSheetLayout, tallestColumnMm } from "@/lib/stock/count-sheet-layout";

describe("folha de contagem — encaixe na folha A4", () => {
  it("com ~73 produtos em 4 setores a lista enche a folha, sem passar", () => {
    const layout = countSheetLayout(73, 4);
    const column = tallestColumnMm(layout, 73, 4);
    expect(column).toBeLessThanOrEqual(LIST_AVAILABLE_MM + 1e-9);
    expect(column).toBeGreaterThan(LIST_AVAILABLE_MM * 0.97);
    expect(layout.rowMm).toBeGreaterThan(5);
  });

  it("cabe no espaço da lista para qualquer quantidade que o tamanho mínimo permita", () => {
    for (const rows of [20, 40, 60, 73, 90, 110]) {
      for (const sections of [1, 2, 4, 6]) {
        const layout = countSheetLayout(rows, sections);
        if (layout.rowMm > 3.4) expect(tallestColumnMm(layout, rows, sections)).toBeLessThanOrEqual(LIST_AVAILABLE_MM + 1e-9);
      }
    }
  });

  it("com poucos produtos não estica a linha demais", () => {
    expect(countSheetLayout(6, 1).rowMm).toBe(7);
  });

  it("com produtos demais cai no tamanho mínimo", () => {
    expect(countSheetLayout(400, 4).rowMm).toBe(3.4);
  });

  it("a letra acompanha a altura da linha, dentro de um limite legível", () => {
    expect(countSheetLayout(73, 4).fontMm).toBeGreaterThanOrEqual(2.2);
    expect(countSheetLayout(6, 1).fontMm).toBeLessThanOrEqual(3.2);
  });
});
