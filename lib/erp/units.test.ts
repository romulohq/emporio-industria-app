import { describe, expect, it } from "vitest";
import { suggestUnitMeasure, suggestWeightKg } from "@/lib/erp/analyze";
import { descriptionIsKg, effectiveUnitMeasure } from "@/lib/erp/units";

describe("KG na descrição", () => {
  it("reconhece item de quilo", () => {
    for (const d of ["PI CANJA KG", "PI MASSA ALM MLH ABX KG", "EDPC SP RECHEIO CARNE DE SOL BASE KG", "PI PAO FRANCES INTEGRAL KG"]) {
      expect(descriptionIsKg(d), d).toBe(true);
    }
  });

  it("gramagem na frente é peso da unidade, não item de quilo", () => {
    for (const d of ["PI PAO FR C C SOL 100G", "BOLO 1KG", "BOLO 1,5 KG", "PI PAO DE QUEIJO 70G", "PI PURE DE BATATA"]) {
      expect(descriptionIsKg(d), d).toBe(false);
    }
  });
});

describe("medida que vale", () => {
  const canja = { unitMeasure: "UNID", description: "PI CANJA KG" };

  it("item de quilo vira KG mesmo com UNID no relatório", () => {
    expect(effectiveUnitMeasure(canja)).toBe("KG");
    expect(effectiveUnitMeasure({ unitMeasure: "KG", description: "PI PAO FRANCES KG" })).toBe("KG");
  });

  it("unidade de verdade continua unidade", () => {
    expect(effectiveUnitMeasure({ unitMeasure: "UNID", description: "PI PAO FR C C SOL 100G" })).toBe("UNID");
  });

  it("Cozinha é sempre kg; o catálogo manda quando tem medida", () => {
    expect(effectiveUnitMeasure({ unitMeasure: "UNID", description: "PI PURE DE BATATA" }, { unitMeasure: null, sector: "Cozinha" })).toBe("KG");
    expect(effectiveUnitMeasure(canja, { unitMeasure: "UNID", sector: "Cozinha" })).toBe("UNID");
    expect(effectiveUnitMeasure({ unitMeasure: "UNID", description: "PI X" }, { unitMeasure: "KG", sector: null })).toBe("KG");
  });
});

describe("sugestões ao cadastrar", () => {
  it("itens de quilo: medida KG e peso 1, mesmo vindo como UNID", () => {
    expect(suggestUnitMeasure("PI CANJA KG", "UNID")).toBe("KG");
    expect(suggestWeightKg("PI CANJA KG", suggestUnitMeasure("PI CANJA KG", "UNID"))).toBe(1);
    expect(suggestWeightKg("PI CANJA KG", "UNID")).toBe(1);
  });

  it("unidade com gramagem continua com o peso da descrição", () => {
    expect(suggestUnitMeasure("PI PAO FR C C SOL 100G", "UNID")).toBe("UNID");
    expect(suggestWeightKg("PI PAO FR C C SOL 100G", "UNID")).toBe(0.1);
  });
});
