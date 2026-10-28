import { describe, expect, it } from "vitest";
import { END_DATE_WARNING } from "@/lib/erp/columns";
import { extractPageRows, type PdfTextItem } from "@/lib/erp/pdf-table";

const at = (str: string, start: number, end: number, y: number): PdfTextItem => ({ str, x: start, y, width: end - start });

/** Modelo novo do relatório do Everest (outubro): sem Fantasia, Embalagem, Tipo do Item e D. Lançamento. */
function headerItems(y: number): PdfTextItem[] {
  return [
    at("Empresa", 28.8, 55.6, y),
    at("Série", 56.5, 71.9, y),
    at("N. Ordem", 88, 118.5, y),
    at("Item", 119.4, 133.6, y),
    at("Descrição do Item", 154.7, 211.3, y),
    at("UM", 332.3, 343.6, y),
    at("Data/Hora Fim", 357, 402.9, y),
    at("Q. Produção", 471.2, 509.9, y),
    at("Total Produção", 535.8, 582.5, y),
    at("Q. Teórica", 616.2, 647, y),
    at("V. Custo", 667.6, 693.5, y),
    at("Situação", 694.4, 720.9, y),
    at("Status", 746, 764.9, y),
  ];
}

function orderItems(y: number, o: { number: string; item: string; desc: string; um: string; end: string; qProd: string; total: string; cost: string; situation: string }): PdfTextItem[] {
  return [
    at("18", 47.9, 55.6, y),
    at("OPR", 56.5, 70, y),
    at(o.number, 103.2, 118.5, y),
    at(o.item, 119.4, 146.3, y),
    at(o.desc, 154.7, 154.7 + o.desc.length * 3.4, y),
    at(o.um, 332.3, 332.3 + o.um.length * 4, y),
    at(o.end, 357, 421.4, y),
    at(o.qProd, 509.9 - o.qProd.length * 3.4, 509.9, y),
    at(o.total, 582.5 - o.total.length * 3.4, 582.5, y),
    at("1,000000", 618.5, 647, y),
    at(o.cost, 693.5 - o.cost.length * 3.4, 693.5, y),
    at(o.situation, 694.4, 734, y),
    at("EM PROGRAMAÇÃO", 746, 809.8, y),
  ];
}

const FIRST = { number: "3098", item: "9000010", desc: "PI PAO FR ER SAL 100G", um: "UNID", end: "29/09/2026 17:00:00", qProd: "1.010,000000", total: "1.010,000000", cost: "0,65", situation: "CONCLUÍDO" };
// a Q. Produção do Everest veio 1 enquanto o Total Produção é o que de fato foi produzido
const SECOND = { number: "3250", item: "9000024", desc: "PI PAO FRANCES KG", um: "KG", end: "26/10/2026 17:00:00", qProd: "1,000000", total: "7.268,000000", cost: "2,37", situation: "CONCLUÍDO" };

const page = (withFooterUnit = true): PdfTextItem[] => [
  ...headerItems(78.8),
  ...orderItems(92.8, FIRST),
  ...orderItems(107, SECOND),
  // linha de total: nº de ordens à direita da coluna Empresa, soma de Q. Produção, Total Produção, Q. Teórica e custo
  at("155", 42.6, 54.2, 121.2),
  at("237.571,000000", 459.1, 508.4, 121.2),
  at("244.838,000000", 531.7, 581, 121.2),
  at("5.780,594000", 604, 645.5, 121.2),
  at("1.478,33", 665.8, 692, 121.2),
  at("<Filtro está vazio>", 20.5, 78.8, 575),
  at("[EVEREST 3.0] IBARRETO - 28/10/2026 07:42", 20, 175.3, 590),
  at("5 de 5", 412.6, 434.5, 590),
  ...(withFooterUnit ? [at("18 - FABRICA CONGELADOS", 726.8, 827.1, 590)] : []),
];

describe("relatório do Everest — modelo sem D. Lançamento (outubro)", () => {
  it("lê as ordens pela Data/Hora Fim e pega a unidade do nome impresso na página", () => {
    const result = extractPageRows(page(), 1, null);
    expect(result.problems).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      unit: "18 - FABRICA CONGELADOS",
      orderNumber: 3098,
      productCode: "9000010",
      description: "PI PAO FR ER SAL 100G",
      unitMeasure: "UNID",
      launchDate: "2026-09-29",
      quantity: 1010,
      unitCost: 0.65,
      status: "CONCLUÍDO",
    });
    expect(result.warnings).toContain(END_DATE_WARNING);
  });

  it("a quantidade é o Total Produção, não a Q. Produção", () => {
    const [, second] = extractPageRows(page(), 1, null).rows;
    expect(second).toMatchObject({ orderNumber: 3250, quantity: 7268, launchDate: "2026-10-26", unitMeasure: "KG" });
  });

  it("lê a linha de total (nº de ordens e soma de Total Produção) para a conferência", () => {
    const result = extractPageRows(page(), 1, null);
    expect(result.declaredTotal).toBe(155);
    expect(result.declaredQuantity).toBe(244838);
  });

  it("sem o nome da unidade na página, grava só o código da empresa e avisa", () => {
    const result = extractPageRows(page(false), 1, null);
    expect(result.rows[0].unit).toBe("18");
    expect(result.warnings.some((w) => w.includes("não traz o nome da unidade"))).toBe(true);
  });
});
