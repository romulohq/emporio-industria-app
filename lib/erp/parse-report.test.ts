import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseReport } from "@/lib/erp/parse-report";
import { checkIntegrity } from "@/lib/erp/integrity";

const fixturePath = (name: string) => path.resolve(__dirname, "../../tests/fixtures", name);
const fixture = (name: string) => new Uint8Array(readFileSync(fixturePath(name)));

// o PDF de exemplo traz dados reais de produção e custo e não vai para o repositório público:
// coloque-o em tests/fixtures/SETEMBRO26.pdf para rodar estes testes localmente
describe.skipIf(!existsSync(fixturePath("SETEMBRO26.pdf")))("relatório de ordens do ERP — SETEMBRO26.pdf", () => {
  it("lê as 154 ordens de 01/09/2026 a 29/09/2026 (150 CONCLUÍDO e 4 ATIVO)", async () => {
    const report = await parseReport(fixture("SETEMBRO26.pdf"), "SETEMBRO26.pdf");

    expect(report.kind).toBe("pdf");
    expect(report.problems).toEqual([]);
    expect(report.declaredTotal).toBe(154);
    expect(report.rows).toHaveLength(154);
    expect(checkIntegrity(report)).toEqual({ ok: true, messages: [], badPages: [] });

    const dates = report.rows.map((r) => r.launchDate).sort();
    expect(dates[0]).toBe("2026-09-01");
    expect(dates[dates.length - 1]).toBe("2026-09-29");

    const byStatus = (status: string) => report.rows.filter((r) => r.status === status).length;
    expect(byStatus("CONCLUÍDO")).toBe(150);
    expect(byStatus("ATIVO")).toBe(4);
  });

  it("não repete número de ordem e todas as linhas são da unidade 18", async () => {
    const { rows } = await parseReport(fixture("SETEMBRO26.pdf"), "SETEMBRO26.pdf");
    expect(new Set(rows.map((r) => r.orderNumber)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.unit))).toEqual(new Set(["18 - FABRICA CONGELADOS"]));
  });

  it("separa as colunas pela posição, sem se perder nas descrições com espaços", async () => {
    const { rows } = await parseReport(fixture("SETEMBRO26.pdf"), "SETEMBRO26.pdf");
    const byNumber = (n: number) => rows.find((r) => r.orderNumber === n)!;

    expect(byNumber(3076)).toMatchObject({
      productCode: "9000001",
      description: "PI PAO FR C C SOL 100G",
      packaging: "UNIDADE",
      unitMeasure: "UNID",
      itemType: "PRODUTO INTERMEDIARIO",
      launchDate: "2026-09-25",
      quantity: 1560,
      unitCost: 2.89,
      status: "CONCLUÍDO",
    });
    expect(byNumber(3008)).toMatchObject({
      productCode: "4000012",
      description: "EDPC SP RECHEIO CARNE DE SOL BASE KG",
      packaging: "QUILOGRAMA",
      unitMeasure: "KG",
      itemType: "SUBPRODUTO",
      launchDate: "2026-09-14",
      quantity: 145,
      unitCost: 60.27,
      status: "CONCLUÍDO",
    });
    expect(byNumber(3084)).toMatchObject({
      productCode: "9000024",
      description: "PI PAO FRANCES KG",
      launchDate: "2026-09-25",
      quantity: 2212,
      unitCost: 2.37,
    });
  });

  it("a soma de Total Produção bate com a linha de total do relatório (324.238,74)", async () => {
    const report = await parseReport(fixture("SETEMBRO26.pdf"), "SETEMBRO26.pdf");
    expect(report.declaredQuantity).toBeCloseTo(324238.74, 2);
    const sum = report.rows.reduce((total, row) => total + row.quantity, 0);
    expect(sum).toBeCloseTo(324238.74, 2);
  });

  it("soma por página as mesmas 154 linhas (5 páginas)", async () => {
    const report = await parseReport(fixture("SETEMBRO26.pdf"), "SETEMBRO26.pdf");
    expect(report.pages).toHaveLength(5);
    expect(report.pages.reduce((sum, p) => sum + p.rowsRead, 0)).toBe(154);
  });
});
