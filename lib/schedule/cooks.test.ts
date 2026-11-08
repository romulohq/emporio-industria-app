import { describe, expect, it } from "vitest";
import { COOK_COLORS, cookInitial, cookLoad, nextCookColor } from "./cooks";

describe("nextCookColor", () => {
  it("usa a primeira cor livre", () => {
    expect(nextCookColor([])).toBe(COOK_COLORS[0]);
    expect(nextCookColor([COOK_COLORS[0], COOK_COLORS[2]])).toBe(COOK_COLORS[1]);
  });
  it("recomeça a lista quando todas estão em uso", () => {
    expect(nextCookColor([...COOK_COLORS])).toBe(COOK_COLORS[0]);
  });
});

describe("cookInitial", () => {
  it("é a primeira letra, maiúscula", () => {
    expect(cookInitial(" ana")).toBe("A");
    expect(cookInitial("")).toBe("?");
  });
});

describe("cookLoad", () => {
  const items = new Set(["i1", "i2"]);
  it("conta as tarefas de cada pessoa por dia", () => {
    const cells = { "i1:1": "Produzir", "i2:1": "Empacotar", "i1:2": "Produzir" };
    const cooks = { "i1:1": ["a", "b"], "i2:1": ["a"], "i1:2": ["b"] };
    const load = cookLoad(cells, cooks, items);
    expect(load.get("a:1")).toBe(2);
    expect(load.get("b:1")).toBe(1);
    expect(load.get("b:2")).toBe(1);
    expect(load.get("a:2")).toBeUndefined();
  });
  it("ignora células sem texto e produtos de outros setores", () => {
    const load = cookLoad({ "i1:1": "", "x:1": "Produzir" }, { "i1:1": ["a"], "x:1": ["a"] }, items);
    expect(load.size).toBe(0);
  });
  it("não conta duas vezes a mesma pessoa na mesma célula", () => {
    const load = cookLoad({ "i1:1": "Produzir" }, { "i1:1": ["a", "a"] }, items);
    expect(load.get("a:1")).toBe(1);
  });
});
