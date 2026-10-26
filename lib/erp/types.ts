export type ErpFileKind = "pdf" | "xlsx" | "csv";

/** Uma ordem de produção lida do relatório. */
export type ErpOrderRow = {
  unit: string;
  orderNumber: number;
  productCode: string;
  description: string;
  packaging: string;
  unitMeasure: string;
  itemType: string;
  launchDate: string;
  quantity: number;
  unitCost: number;
  status: string;
  /** página do PDF (ou null em xlsx/csv) */
  page: number | null;
};

export type ParseProblem = {
  page: number | null;
  /** posição da linha dentro da página (PDF) ou número da linha da planilha */
  row: number | null;
  message: string;
};

export type ParsedReport = {
  kind: ErpFileKind;
  rows: ErpOrderRow[];
  /** total de ordens impresso no rodapé da última página (só PDF) */
  declaredTotal: number | null;
  /** soma de Total Produção impressa na linha de total (só PDF) */
  declaredQuantity: number | null;
  pages: { page: number; rowsRead: number; problems: number }[];
  problems: ParseProblem[];
  warnings: string[];
};

export type Integrity = {
  ok: boolean;
  messages: string[];
  /** páginas com problema (linha ilegível ou contagem abaixo das demais páginas cheias) */
  badPages: number[];
};

/** Chave estável de uma ordem dentro do arquivo (unidade + número). */
export function orderKey(row: Pick<ErpOrderRow, "unit" | "orderNumber">): string {
  return `${row.unit}#${row.orderNumber}`;
}
