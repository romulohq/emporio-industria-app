import { normalizeText, parseBrDate, parseBrNumber } from "@/lib/erp/br";
import type { ErpOrderRow } from "@/lib/erp/types";

export type ColumnKey =
  | "company"
  | "trade"
  | "orderNumber"
  | "productCode"
  | "description"
  | "packaging"
  | "unitMeasure"
  | "itemType"
  | "launchDate"
  | "quantity"
  | "unitCost"
  | "status";

export const COLUMN_ORDER: ColumnKey[] = [
  "company",
  "trade",
  "orderNumber",
  "productCode",
  "description",
  "packaging",
  "unitMeasure",
  "itemType",
  "launchDate",
  "quantity",
  "unitCost",
  "status",
];

/** Título do cabeçalho (sem acento, sem pontuação) → coluna. */
const LABELS: Record<string, ColumnKey> = {
  EMPRESA: "company",
  FANTASIA: "trade",
  "N ORDEM": "orderNumber",
  ITEM: "productCode",
  "DESCRICAO DO ITEM": "description",
  EMBALAGEM: "packaging",
  UM: "unitMeasure",
  "TIPO DO ITEM": "itemType",
  "D LANCAMENTO": "launchDate",
  "TOTAL PRODUCAO": "quantity",
  "V CUSTO": "unitCost",
  SITUACAO: "status",
};

export function normalizeLabel(text: string): string {
  return normalizeText(text).replace(/[.:]/g, "").replace(/\s+/g, " ").trim();
}

export function columnForLabel(text: string): ColumnKey | null {
  return LABELS[normalizeLabel(text)] ?? null;
}

export type RawCells = Partial<Record<ColumnKey, string | number | Date | null>>;

const REQUIRED: { key: ColumnKey; label: string }[] = [
  { key: "company", label: "Empresa" },
  { key: "trade", label: "Fantasia" },
  { key: "orderNumber", label: "N. Ordem" },
  { key: "productCode", label: "Item" },
  { key: "description", label: "Descrição do Item" },
  { key: "launchDate", label: "D. Lançamento" },
  { key: "quantity", label: "Total Produção" },
  { key: "status", label: "Situação" },
];

function text(value: RawCells[ColumnKey]): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

/** Valida e converte uma linha de células. Devolve a linha pronta ou o motivo de ela ser ilegível. */
export function buildOrderRow(
  cells: RawCells,
  page: number | null
): { row: ErpOrderRow; warnings: string[] } | { error: string } {
  const missing = REQUIRED.filter(({ key }) => text(cells[key]) === "").map(({ label }) => label);
  if (missing.length) return { error: `coluna(s) vazia(s): ${missing.join(", ")}` };

  const company = text(cells.company);
  const trade = text(cells.trade);
  const orderNumber = parseBrNumber(text(cells.orderNumber).replace(/\.0+$/, ""));
  if (orderNumber == null || !Number.isInteger(orderNumber) || orderNumber <= 0) {
    return { error: `número de ordem inválido: "${text(cells.orderNumber)}"` };
  }
  const launchDate = parseBrDate(cells.launchDate instanceof Date ? cells.launchDate : text(cells.launchDate));
  if (!launchDate) return { error: `data inválida: "${text(cells.launchDate)}"` };

  const quantity = parseBrNumber(typeof cells.quantity === "number" ? cells.quantity : text(cells.quantity));
  if (quantity == null) return { error: `quantidade inválida: "${text(cells.quantity)}"` };
  const rawCost = text(cells.unitCost);
  const unitCost = rawCost === "" ? 0 : parseBrNumber(typeof cells.unitCost === "number" ? cells.unitCost : rawCost);
  if (unitCost == null) return { error: `custo inválido: "${rawCost}"` };

  const unitMeasure = text(cells.unitMeasure).toUpperCase();
  const warnings: string[] = [];
  if (unitMeasure !== "UNID" && unitMeasure !== "KG") {
    warnings.push(`Ordem ${orderNumber}: UM "${unitMeasure || "(vazia)"}" não é UNID nem KG — tratada como unidade.`);
  }

  return {
    row: {
      unit: `${company} - ${trade}`,
      orderNumber,
      productCode: text(cells.productCode),
      description: text(cells.description),
      packaging: text(cells.packaging),
      unitMeasure,
      itemType: text(cells.itemType),
      launchDate,
      quantity,
      unitCost,
      status: text(cells.status),
      page,
    },
    warnings,
  };
}
