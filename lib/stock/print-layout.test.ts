import { describe, expect, it } from "vitest";
import { stockPrintLayout, tallestColumnMm } from "@/lib/stock/print-layout";

const PAGE_BODY_MM = 281 - 17 - 8;

describe("estoque da câmara — encaixe na folha A4", () => {
  it("com ~76 produtos em 4 setores a coluna mais alta quase enche a folha, sem passar", () => {
    const layout = stockPrintLayout(76, 4);
    const column = tallestColumnMm(layout, 76, 4);
    expect(column).toBeLessThanOrEqual(PAGE_BODY_MM);
    expect(column).toBeGreaterThan(PAGE_BODY_MM * 0.93);
    // as linhas ficam bem maiores que as ~3,3 mm de antes
    expect(layout.rowMm).toBeGreaterThan(5.5);
  });

  it("cabe na folha para qualquer quantidade que o tamanho mínimo permita", () => {
    for (const rows of [20, 40, 60, 76, 90, 110]) {
      for (const sections of [1, 2, 4, 6]) {
        const layout = stockPrintLayout(rows, sections);
        if (layout.rowMm > 3.2) expect(tallestColumnMm(layout, rows, sections)).toBeLessThanOrEqual(PAGE_BODY_MM);
      }
    }
  });

  it("com poucos produtos não estica a linha demais", () => {
    expect(stockPrintLayout(6, 1).rowMm).toBe(9);
  });

  it("com produtos demais cai no tamanho mínimo (e passa para a 2ª página, como antes)", () => {
    expect(stockPrintLayout(400, 4).rowMm).toBe(3.2);
  });

  it("a letra e a barra acompanham a altura da linha dentro de limites legíveis", () => {
    const layout = stockPrintLayout(76, 4);
    expect(layout.fontMm).toBeGreaterThanOrEqual(2.4);
    expect(layout.fontMm).toBeLessThanOrEqual(3);
    expect(layout.barMm).toBeGreaterThanOrEqual(2.2);
    expect(layout.barMm).toBeLessThanOrEqual(3.4);
  });
});
