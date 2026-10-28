import { describe, expect, it } from "vitest";
import { accumulateByMonth, type StoredOrder } from "@/lib/erp/monthly";

const order = (over: Partial<StoredOrder>): StoredOrder => ({
  product_code: "1",
  erp_description: "PRODUTO",
  launch_date: "2026-10-05",
  quantity: 10,
  unit_measure: "KG",
  status: "CONCLUÍDO",
  ...over,
});

const catalog = new Map([
  ["1", { displayName: "Produto Real", unitWeightKg: 1 }],
  ["2", { displayName: "Pão 50g", unitWeightKg: 0.05 }],
]);

describe("acumulado por mês", () => {
  it("soma as ordens de cada mês e separa os meses (mais recente primeiro)", () => {
    const months = accumulateByMonth(
      [order({}), order({ quantity: 5 }), order({ launch_date: "2026-09-30", quantity: 7 })],
      catalog
    );
    expect(months.map((m) => [m.month, m.orders, m.kg])).toEqual([
      ["2026-10", 2, 15],
      ["2026-09", 1, 7],
    ]);
  });

  it("converte unidades em kg pelo peso do catálogo e usa o nome real", () => {
    const [m] = accumulateByMonth([order({ product_code: "2", unit_measure: "UNID", quantity: 200 })], catalog);
    expect(m.units).toBe(200);
    expect(m.kg).toBe(10);
    expect(m.products[0].name).toBe("Pão 50g");
  });

  it("unidade sem peso fica fora do kg e é contada; ordem não concluída é sinalizada", () => {
    const [m] = accumulateByMonth([order({ product_code: "9", unit_measure: "UNID", status: "ATIVO" })], catalog);
    expect(m.kg).toBe(0);
    expect(m.withoutWeight).toBe(1);
    expect(m.open).toBe(1);
    expect(m.products[0].name).toBe("PRODUTO");
  });
});
