import { describe, expect, it } from "vitest";
import { buildTree, wouldCreateCycle, type SubproductRecipe } from "@/lib/recipes/tree";

const cebola: SubproductRecipe = {
  name: "Cebola caramelizada",
  yieldQuantity: 10,
  yieldUnit: "kg",
  lines: [
    { name: "Cebola", subproductId: null, quantity: 12, unit: "kg" },
    { name: "Óleo", subproductId: null, quantity: 1, unit: "L" },
  ],
};

describe("buildTree", () => {
  it("expands a subproduct scaled to the quantity used", () => {
    const tree = buildTree(
      [
        { name: "Carne de sol", subproductId: null, quantity: 8, unit: "kg" },
        { name: null, subproductId: "sp1", quantity: 5, unit: "kg" },
      ],
      { sp1: cebola }
    );
    expect(tree[0].children).toEqual([]);
    expect(tree[1].label).toBe("Cebola caramelizada");
    expect(tree[1].children.map((c) => [c.label, c.quantity])).toEqual([
      ["Cebola", 6],
      ["Óleo", 0.5],
    ]);
    expect(tree[1].unscaled).toBe(false);
  });

  it("shows the recipe as written when the units differ", () => {
    const tree = buildTree([{ name: null, subproductId: "sp1", quantity: 3, unit: "und" }], { sp1: cebola });
    expect(tree[0].children[0].quantity).toBe(12);
    expect(tree[0].unscaled).toBe(true);
  });

  it("marks subproducts without a recipe and stops on cycles", () => {
    expect(buildTree([{ name: null, subproductId: "x", quantity: 1, unit: "kg" }], {})[0].noRecipe).toBe(true);
    const loop: SubproductRecipe = {
      name: "A",
      yieldQuantity: 1,
      yieldUnit: "kg",
      lines: [{ name: null, subproductId: "a", quantity: 1, unit: "kg" }],
    };
    const tree = buildTree([{ name: null, subproductId: "a", quantity: 1, unit: "kg" }], { a: loop });
    expect(tree[0].children[0].cycle).toBe(true);
  });
});

describe("wouldCreateCycle", () => {
  const a: SubproductRecipe = {
    name: "A",
    yieldQuantity: 1,
    yieldUnit: "kg",
    lines: [{ name: null, subproductId: "b", quantity: 1, unit: "kg" }],
  };
  const b: SubproductRecipe = { name: "B", yieldQuantity: 1, yieldUnit: "kg", lines: [] };

  it("detects direct and indirect self-reference", () => {
    expect(wouldCreateCycle("a", [{ name: null, subproductId: "a", quantity: 1, unit: "kg" }], { a, b })).toBe(true);
    expect(wouldCreateCycle("b", [{ name: null, subproductId: "a", quantity: 1, unit: "kg" }], { a, b })).toBe(true);
    expect(wouldCreateCycle("a", [{ name: "sal", subproductId: null, quantity: 1, unit: "kg" }], { a, b })).toBe(false);
  });
});
