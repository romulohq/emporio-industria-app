import { describe, expect, it } from "vitest";
import { batchesOfLabel, computeDemand, convertQuantity, quantityToOrder } from "@/lib/hortifruti/demand";
import type { SubproductRecipe } from "@/lib/recipes/tree";

const HORTI = new Map([
  ["batata", "kg"],
  ["cebola", "kg"],
  ["salsinha", "kg"],
]);

const line = (rawMaterialId: string, name: string, quantity: number, unit = "kg") => ({
  name,
  rawMaterialId,
  subproductId: null,
  quantity,
  unit,
});

describe("computeDemand", () => {
  it("multiplies a sheet by the batches and sums per raw material and per day", () => {
    const sopa = { lines: [line("batata", "MP BATATA", 24), line("cebola", "MP CEBOLA", 15), line("sal", "MP SAL", 1)] };
    const result = computeDemand({
      productions: [
        { date: "2026-10-28", scheduleItemId: "sopa", name: "Sopa de carne", batches: 1 },
        { date: "2026-10-30", scheduleItemId: "sopa", name: "Sopa de carne", batches: 2 },
      ],
      recipeByItem: new Map([["sopa", sopa]]),
      subproducts: {},
      hortifruti: HORTI,
    });
    expect(result.byMaterial.get("batata")?.total).toBe(72);
    expect(result.byMaterial.get("batata")?.byDate.get("2026-10-30")).toBe(48);
    expect(result.byMaterial.get("cebola")?.total).toBe(45);
    // only hortifruti raw materials are counted
    expect(result.byMaterial.has("sal")).toBe(false);
  });

  it("opens subproducts down to their raw materials, scaled to what the sheet uses", () => {
    const pasta: SubproductRecipe = {
      name: "Pasta de cebola",
      yieldQuantity: 10,
      yieldUnit: "kg",
      lines: [line("cebola", "MP CEBOLA", 8)],
    };
    const recheio = {
      lines: [{ name: null, rawMaterialId: null, subproductId: "pasta", quantity: 5, unit: "kg" }],
    };
    const result = computeDemand({
      productions: [{ date: "2026-10-28", scheduleItemId: "recheio", name: "Recheio", batches: 2 }],
      recipeByItem: new Map([["recheio", recheio]]),
      subproducts: { pasta },
      hortifruti: HORTI,
    });
    // 2 batches x 5 kg of pasta = 10 kg of pasta = one full recipe = 8 kg of onion
    expect(result.byMaterial.get("cebola")?.total).toBeCloseTo(8);
  });

  it("converts units and reports the ones that cannot be converted", () => {
    const recipe = { lines: [line("salsinha", "MP SALSINHA", 500, "g"), line("cebola", "MP CEBOLA", 2, "maço")] };
    const result = computeDemand({
      productions: [{ date: "2026-10-28", scheduleItemId: "x", name: "X", batches: 1 }],
      recipeByItem: new Map([["x", recipe]]),
      subproducts: {},
      hortifruti: HORTI,
    });
    expect(result.byMaterial.get("salsinha")?.total).toBeCloseTo(0.5);
    expect(result.unitMismatches).toHaveLength(1);
    expect(result.byMaterial.has("cebola")).toBe(false);
  });

  it("lists productions without a technical sheet", () => {
    const result = computeDemand({
      productions: [{ date: "2026-10-28", scheduleItemId: "y", name: "Sem ficha", batches: 1 }],
      recipeByItem: new Map(),
      subproducts: {},
      hortifruti: HORTI,
    });
    expect(result.withoutRecipe.map((p) => p.name)).toEqual(["Sem ficha"]);
  });
});

describe("batchesOfLabel / quantityToOrder / convertQuantity", () => {
  it("reads the batches from the schedule label", () => {
    expect(batchesOfLabel("Produzir")).toBe(1);
    expect(batchesOfLabel("2x Produzir")).toBe(2);
    expect(batchesOfLabel("Descongelar")).toBe(0);
    expect(batchesOfLabel("Marinar")).toBe(0);
  });

  it("orders only what is missing", () => {
    expect(quantityToOrder(72, 20)).toBe(52);
    expect(quantityToOrder(10, 25)).toBe(0);
  });

  it("converts mass and volume", () => {
    expect(convertQuantity(1500, "g", "kg")).toBe(1.5);
    expect(convertQuantity(2, "L", "mL")).toBe(2000);
    expect(convertQuantity(1, "kg", "L")).toBeNull();
  });
});
