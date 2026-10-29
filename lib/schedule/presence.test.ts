import { describe, expect, it } from "vitest";
import { PRESENCE_COLORS, colorFor, firstName, groupByCell, otherTabs, uniqueUsers, type Collaborator } from "@/lib/schedule/presence";

const person = (over: Partial<Collaborator>): Collaborator => ({
  tab: "t1",
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

  it("tira só esta aba: a mesma pessoa em outra aba aparece para quem a vê", () => {
    const list = [
      person({ tab: "t1", userId: "me" }),
      person({ tab: "t2", userId: "me", cell: "x:1" }),
      person({ tab: "t3", userId: "u2", name: "Bia" }),
    ];
    expect(otherTabs(list, "t1").map((o) => [o.tab, o.cell])).toEqual([
      ["t2", "x:1"],
      ["t3", null],
    ]);
  });

  it("nas bolinhas do topo cada pessoa aparece uma vez", () => {
    const list = [person({ tab: "a", userId: "u2" }), person({ tab: "b", userId: "u2" }), person({ tab: "c", userId: "u3" })];
    expect(uniqueUsers(list).map((o) => o.userId)).toEqual(["u2", "u3"]);
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
