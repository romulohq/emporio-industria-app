import { describe, expect, it } from "vitest";
import { autoYield } from "@/lib/recipes/yield";

describe("rendimento automático", () => {
  it("soma kg, g, L e mL em kg", () => {
    const result = autoYield([
      { quantity: 10, unit: "kg" },
      { quantity: 500, unit: "g" },
      { quantity: 2, unit: "L" },
      { quantity: 250, unit: "mL" },
    ]);
    expect(result).toEqual({ quantity: 12.75, unit: "kg", ignored: 0 });
  });

  it("ignora unidade, pacote e caixa e avisa quantos ficaram de fora", () => {
    const result = autoYield([
      { quantity: 3, unit: "kg" },
      { quantity: 77, unit: "und" },
      { quantity: 2, unit: "cx" },
    ]);
    expect(result).toEqual({ quantity: 3, unit: "kg", ignored: 2 });
  });

  it("a marinada de carne dá os 52,27 kg dos ingredientes (louro em unidade fica fora)", () => {
    const lines = [30.78, 1.54, 3.39, 2.3, 3.39, 1.23, 5.39, 1.54, 0.7, 0.31, 0.23, 0.24, 1.23].map((quantity, i) => ({
      quantity,
      unit: [0, 1, 2, 4].includes(i) ? "L" : "kg",
    }));
    const result = autoYield([...lines, { quantity: 77, unit: "und" }]);
    expect(result).toEqual({ quantity: 52.27, unit: "kg", ignored: 1 });
  });

  it("sem nada somável não inventa rendimento", () => {
    expect(autoYield([])).toBeNull();
    expect(autoYield([{ quantity: 4, unit: "und" }])).toBeNull();
  });

  it("dá o mesmo resultado em qualquer caixa de letra da unidade", () => {
    expect(autoYield([{ quantity: 1, unit: " KG " }, { quantity: 1, unit: "l" }])?.quantity).toBe(2);
  });
});
