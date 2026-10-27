import { describe, expect, it } from "vitest";
import { parseBrDate, parseBrNumber } from "@/lib/erp/br";
import {
  analyzeRows,
  applyImportOptions,
  median,
  suggestWeightKg,
  type AnalysisContext,
} from "@/lib/erp/analyze";
import { checkIntegrity } from "@/lib/erp/integrity";
import { extractSheetRows, parseCsvText } from "@/lib/erp/sheet-table";
import type { ErpOrderRow, ParsedReport } from "@/lib/erp/types";

const row = (over: Partial<ErpOrderRow> & { orderNumber: number }): ErpOrderRow => ({
  unit: "18 - FABRICA CONGELADOS",
  productCode: "9000001",
  description: "PI PAO FR C C SOL 100G",
  packaging: "UNIDADE",
  unitMeasure: "UNID",
  itemType: "PRODUTO INTERMEDIARIO",
  launchDate: "2026-09-10",
  quantity: 100,
  unitCost: 2.89,
  status: "CONCLUÍDO",
  page: 1,
  ...over,
});

const emptyCtx = (): AnalysisContext => ({ catalog: new Map(), history: [], existing: new Map() });

describe("números e datas no padrão brasileiro", () => {
  it("lê milhar com ponto e decimal com vírgula", () => {
    expect(parseBrNumber("1.560,000000")).toBe(1560);
    expect(parseBrNumber("2,89")).toBe(2.89);
    expect(parseBrNumber("324.238,740000")).toBe(324238.74);
    expect(parseBrNumber("36")).toBe(36);
    expect(parseBrNumber("abc")).toBeNull();
    expect(parseBrNumber("2.89")).toBeNull();
  });

  it("lê datas dd/mm/aaaa e recusa dias que não existem", () => {
    expect(parseBrDate("25/09/2026")).toBe("2026-09-25");
    expect(parseBrDate("31/02/2026")).toBeNull();
    expect(parseBrDate("2026-09-25")).toBeNull();
  });
});

describe("peso sugerido pela descrição", () => {
  it("converte gramagem em kg", () => {
    expect(suggestWeightKg("PI PAO FR C C SOL 100G", "UNID")).toBe(0.1);
    expect(suggestWeightKg("PI EMPADA PALMITO 90 G", "UNID")).toBe(0.09);
    expect(suggestWeightKg("PI CROISSANT 70G", "UNID")).toBe(0.07);
    expect(suggestWeightKg("BOLO 1,5KG", "UNID")).toBe(1.5);
  });

  it("itens em KG ficam com peso 1; sem gramagem não chuta", () => {
    expect(suggestWeightKg("PI CANJA KG", "KG")).toBe(1);
    expect(suggestWeightKg("PI PAO FRANCES KG", "KG")).toBe(1);
    expect(suggestWeightKg("PI PAO DE QUEIJO", "UNID")).toBeNull();
  });
});

describe("análise da prévia", () => {
  it("totaliza por mês em ordens, unidades e kg", () => {
    const ctx = emptyCtx();
    ctx.catalog.set("9000001", { unitWeightKg: 0.1, unitMeasure: "UNID", sector: null });
    const rows = [
      row({ orderNumber: 1, quantity: 1000 }),
      row({ orderNumber: 2, quantity: 500, launchDate: "2026-10-02" }),
      row({ orderNumber: 3, productCode: "4000012", unitMeasure: "KG", quantity: 36, launchDate: "2026-09-14" }),
    ];
    ctx.catalog.set("4000012", { unitWeightKg: 1, unitMeasure: "KG", sector: null });
    const { months } = analyzeRows(rows, ctx);
    expect(months).toEqual([
      { month: "2026-09", orders: 2, units: 1000, kg: 136, withoutWeight: 0 },
      { month: "2026-10", orders: 1, units: 500, kg: 50, withoutWeight: 0 },
    ]);
  });

  it("avisa de código sem cadastro e de ordens fora de CONCLUÍDO", () => {
    const ctx = emptyCtx();
    ctx.catalog.set("9000001", { unitWeightKg: 0.1, unitMeasure: "UNID", sector: null });
    const rows = [
      row({ orderNumber: 1 }),
      row({ orderNumber: 2, productCode: "9999999", description: "PI NOVO 50G" }),
      row({ orderNumber: 3, status: "ATIVO" }),
    ];
    const analysis = analyzeRows(rows, ctx);
    expect(analysis.unknownCodes).toEqual([{ code: "9999999", description: "PI NOVO 50G", orders: 1 }]);
    expect(analysis.nonConcluded.map((o) => o.orderNumber)).toEqual([3]);
    expect(analysis.statusCounts).toEqual([
      { status: "CONCLUÍDO", count: 2 },
      { status: "ATIVO", count: 1 },
    ]);
    expect([...analysis.flaggedKeys].sort()).toEqual(["18 - FABRICA CONGELADOS#2", "18 - FABRICA CONGELADOS#3"]);
  });

  it("sinaliza quantidade acima de 10x a mediana do produto (usando também o histórico)", () => {
    const ctx = emptyCtx();
    ctx.catalog.set("9000001", { unitWeightKg: 0.1, unitMeasure: "UNID", sector: null });
    ctx.history = [
      { key: "18 - FABRICA CONGELADOS#90", productCode: "9000001", quantity: 100 },
      { key: "18 - FABRICA CONGELADOS#91", productCode: "9000001", quantity: 120 },
    ];
    const rows = [row({ orderNumber: 1, quantity: 100 }), row({ orderNumber: 2, quantity: 5000 })];
    const { outliers } = analyzeRows(rows, ctx);
    expect(outliers).toHaveLength(1);
    expect(outliers[0]).toMatchObject({ orderNumber: 2, quantity: 5000, median: 110 });
  });

  it("não sinaliza com amostra pequena (menos de 3 ordens)", () => {
    const ctx = emptyCtx();
    ctx.catalog.set("9000001", { unitWeightKg: 0.1, unitMeasure: "UNID", sector: null });
    const { outliers } = analyzeRows([row({ orderNumber: 1, quantity: 10 }), row({ orderNumber: 2, quantity: 5000 })], ctx);
    expect(outliers).toEqual([]);
  });

  it("conta ordens que já existem e mostra o que muda", () => {
    const ctx = emptyCtx();
    ctx.catalog.set("9000001", { unitWeightKg: 0.1, unitMeasure: "UNID", sector: null });
    ctx.existing.set("18 - FABRICA CONGELADOS#1", {
      key: "18 - FABRICA CONGELADOS#1",
      productCode: "9000001",
      launchDate: "2026-09-10",
      quantity: 100,
      unitCost: 2.89,
      status: "ATIVO",
    });
    ctx.existing.set("18 - FABRICA CONGELADOS#2", {
      key: "18 - FABRICA CONGELADOS#2",
      productCode: "9000001",
      launchDate: "2026-09-10",
      quantity: 100,
      unitCost: 2.89,
      status: "CONCLUÍDO",
    });
    const { existing } = analyzeRows([row({ orderNumber: 1 }), row({ orderNumber: 2 }), row({ orderNumber: 3 })], ctx);
    expect(existing.count).toBe(2);
    expect(existing.changed).toEqual([
      { key: "18 - FABRICA CONGELADOS#1", orderNumber: 1, changes: ["situação ATIVO → CONCLUÍDO"] },
    ]);
  });
});

describe("opções da importação", () => {
  it("ordens fora de CONCLUÍDO ficam excluídas, a menos que o admin inclua a situação", () => {
    const rows = [row({ orderNumber: 1 }), row({ orderNumber: 2, status: "ATIVO" })];
    const without = applyImportOptions(rows, { includeStatuses: [], overrides: [] }, new Map());
    expect(without.map((r) => r.excluded)).toEqual([false, true]);
    expect(without[1].note).toContain("ATIVO");

    const withActive = applyImportOptions(rows, { includeStatuses: ["ativo"], overrides: [] }, new Map());
    expect(withActive.map((r) => r.excluded)).toEqual([false, false]);
  });

  it("corrige a quantidade e exclui linhas, guardando o motivo", () => {
    const rows = [row({ orderNumber: 1, quantity: 5000 }), row({ orderNumber: 2 })];
    const out = applyImportOptions(
      rows,
      {
        includeStatuses: [],
        overrides: [
          { key: "18 - FABRICA CONGELADOS#1", quantity: 500 },
          { key: "18 - FABRICA CONGELADOS#2", excluded: true },
        ],
      },
      new Map()
    );
    expect(out[0]).toMatchObject({ quantity: 500, excluded: false });
    expect(out[0].note).toContain("5000");
    expect(out[1]).toMatchObject({ excluded: true });
  });
});

describe("itens de quilo que o relatório traz como UNID", () => {
  const canja = (over: Partial<ErpOrderRow> & { orderNumber: number }) =>
    row({ productCode: "9000182", description: "PI CANJA KG", ...over });

  it("entram como kg na prévia e a medida original fica guardada na importação", () => {
    const ctx = emptyCtx();
    const rows = [canja({ orderNumber: 1, quantity: 256 }), row({ orderNumber: 2, quantity: 1000 })];
    ctx.catalog.set("9000001", { unitWeightKg: 0.1, unitMeasure: "UNID", sector: null });

    const analysis = analyzeRows(rows, ctx);
    expect(analysis.months).toEqual([{ month: "2026-09", orders: 2, units: 1000, kg: 356, withoutWeight: 0 }]);
    expect(analysis.unitOverrides).toEqual([{ code: "9000182", description: "PI CANJA KG", orders: 1, from: "UNID" }]);

    const imported = applyImportOptions(rows, { includeStatuses: [], overrides: [] }, ctx.catalog);
    expect(imported[0]).toMatchObject({ unitMeasure: "KG", erpUnitMeasure: "UNID" });
    expect(imported[1]).toMatchObject({ unitMeasure: "UNID", erpUnitMeasure: "UNID" });
  });

  it("produto do setor Cozinha sem KG no nome (Purê de Batata) também é kg", () => {
    const ctx = emptyCtx();
    ctx.catalog.set("9000379", { unitWeightKg: null, unitMeasure: null, sector: "Cozinha" });
    const pure = row({ orderNumber: 1, productCode: "9000379", description: "PI PURE DE BATATA", quantity: 40 });
    expect(analyzeRows([pure], ctx).months[0]).toMatchObject({ units: 0, kg: 40 });
  });

  it("a medida escolhida no catálogo vale mais que a regra", () => {
    const ctx = emptyCtx();
    ctx.catalog.set("9000182", { unitWeightKg: 1, unitMeasure: "UNID", sector: "Cozinha" });
    const [imported] = applyImportOptions([canja({ orderNumber: 1 })], { includeStatuses: [], overrides: [] }, ctx.catalog);
    expect(imported.unitMeasure).toBe("UNID");
  });
});

describe("conferência do total do relatório", () => {
  const report = (rows: ErpOrderRow[], declaredTotal: number | null, pages: number[]): ParsedReport => ({
    kind: "pdf",
    rows,
    declaredTotal,
    declaredQuantity: null,
    pages: pages.map((rowsRead, i) => ({ page: i + 1, rowsRead, problems: 0 })),
    problems: [],
    warnings: [],
  });

  it("passa quando as linhas lidas batem com o total", () => {
    const rows = Array.from({ length: 5 }, (_, i) => row({ orderNumber: i + 1 }));
    expect(checkIntegrity(report(rows, 5, [3, 2])).ok).toBe(true);
  });

  it("bloqueia e aponta a página que veio com menos linhas que as outras cheias", () => {
    const rows = Array.from({ length: 7 }, (_, i) => row({ orderNumber: i + 1 }));
    const result = checkIntegrity(report(rows, 8, [3, 2, 2]));
    expect(result.ok).toBe(false);
    expect(result.badPages).toEqual([2]);
    expect(result.messages[0]).toContain("8 ordens");
  });
});

describe("planilha (xlsx/csv) com as mesmas colunas", () => {
  const csv = [
    "Empresa;Fantasia;N. Ordem;Item;Descrição do Item;Embalagem;UM;Tipo do Item;D. Lançamento;Total Produção;V. Custo;Situação",
    '18;FABRICA CONGELADOS;3076;9000001;"PI PAO FR C C SOL 100G";UNIDADE;UNID;PRODUTO INTERMEDIARIO;25/09/2026;1.560,000000;2,89;CONCLUÍDO',
    "18;FABRICA CONGELADOS;3008;4000012;EDPC SP RECHEIO CARNE DE SOL BASE KG;QUILOGRAMA;KG;SUBPRODUTO;14/09/2026;145,000000;60,27;ATIVO",
  ].join("\n");

  it("lê o csv por nome de coluna", () => {
    const { rows, problems } = extractSheetRows(parseCsvText(csv));
    expect(problems).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ orderNumber: 3076, quantity: 1560, unitCost: 2.89, launchDate: "2026-09-25" });
    expect(rows[1]).toMatchObject({ orderNumber: 3008, status: "ATIVO", unitMeasure: "KG" });
  });

  it("aceita valores nativos de xlsx (número e data)", () => {
    const grid = [
      ["Empresa", "Fantasia", "N. Ordem", "Item", "Descrição do Item", "Embalagem", "UM", "Tipo do Item", "D. Lançamento", "Total Produção", "V. Custo", "Situação"],
      [18, "FABRICA CONGELADOS", 3076, 9000001, "PI PAO FR C C SOL 100G", "UNIDADE", "UNID", "PRODUTO INTERMEDIARIO", new Date("2026-09-25T00:00:00Z"), 1560, 2.89, "CONCLUÍDO"],
    ];
    const { rows, problems } = extractSheetRows(grid);
    expect(problems).toEqual([]);
    expect(rows[0]).toMatchObject({ orderNumber: 3076, productCode: "9000001", quantity: 1560, launchDate: "2026-09-25" });
  });

  it("mediana", () => {
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});
