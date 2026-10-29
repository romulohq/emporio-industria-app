import { describe, expect, it } from "vitest";
import { PRESENCE_COLORS, colorFor, firstName, groupByCell, otherCollaborators, type Collaborator } from "@/lib/schedule/presence";

const person = (over: Partial<Collaborator>): Collaborator => ({
  userId: "u1",
  name: "Ana",
  color: "#111",
  cell: null,
  notes: false,
  ...over,
});

describe("presença no cronograma", () => {
  it("a cor de cada pessoa é sempre a mesma e vem da paleta", () => {
    expect(colorFor("abc-123")).toBe(colorFor("abc-123"));
    expect(PRESENCE_COLORS).toContain(colorFor("abc-123"));
    const used = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map(colorFor));
    expect(used.size).toBeGreaterThan(3);
  });

  it("mostra só o primeiro nome", () => {
    expect(firstName("  Rebeca Silva ")).toBe("Rebeca");
    expect(firstName(null)).toBe("Alguém");
    expect(firstName("")).toBe("Alguém");
  });

  it("tira a própria pessoa e junta as abas repetidas (vale a que está numa célula)", () => {
    const list = [
      person({ userId: "me" }),
      person({ userId: "u2", name: "Bia" }),
      person({ userId: "u2", name: "Bia", cell: "x:1" }),
      person({ userId: "u3", name: "Caio" }),
    ];
    const others = otherCollaborators(list, "me");
    expect(others.map((o) => [o.userId, o.cell])).toEqual([
      ["u2", "x:1"],
      ["u3", null],
    ]);
  });

  it("agrupa por célula e ignora quem não selecionou nenhuma", () => {
    const grouped = groupByCell([
      person({ userId: "a", cell: "x:1" }),
      person({ userId: "b", cell: "x:1" }),
      person({ userId: "c", cell: "y:2" }),
      person({ userId: "d" }),
    ]);
    expect([...grouped.keys()]).toEqual(["x:1", "y:2"]);
    expect(grouped.get("x:1")?.map((c) => c.userId)).toEqual(["a", "b"]);
  });
});
