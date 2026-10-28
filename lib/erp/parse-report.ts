import readXlsxFile from "read-excel-file/node";
import { readPdfPages } from "@/lib/erp/pdf-read";
import { extractPageRows } from "@/lib/erp/pdf-table";
import { extractSheetRows, parseCsvText, type SheetCell } from "@/lib/erp/sheet-table";
import type { ErpFileKind, ParsedReport } from "@/lib/erp/types";

export function detectKind(data: Uint8Array, fileName: string): ErpFileKind {
  const head = String.fromCharCode(...data.slice(0, 5));
  if (head.startsWith("%PDF")) return "pdf";
  if (head.startsWith("PK")) return "xlsx";
  if (/\.xlsx$/i.test(fileName)) return "xlsx";
  if (/\.pdf$/i.test(fileName)) return "pdf";
  return "csv";
}

export async function parsePdfReport(data: Uint8Array): Promise<ParsedReport> {
  const pages = await readPdfPages(data);
  const report: ParsedReport = { kind: "pdf", rows: [], declaredTotal: null, declaredQuantity: null, pages: [], problems: [], warnings: [] };

  let bands = null as ReturnType<typeof extractPageRows>["bands"];
  pages.forEach((items, index) => {
    const result = extractPageRows(items, index + 1, bands);
    bands = result.bands;
    report.rows.push(...result.rows);
    report.problems.push(...result.problems);
    for (const warning of result.warnings) if (!report.warnings.includes(warning)) report.warnings.push(warning);
    if (result.declaredTotal != null) report.declaredTotal = result.declaredTotal;
    if (result.declaredQuantity != null) report.declaredQuantity = result.declaredQuantity;
    report.pages.push({ page: index + 1, rowsRead: result.rows.length, problems: result.problems.length });
  });
  return report;
}

export async function parseSheetReport(data: Uint8Array, kind: "xlsx" | "csv"): Promise<ParsedReport> {
  let grid: SheetCell[][];
  if (kind === "xlsx") {
    const sheets = await readXlsxFile(Buffer.from(data));
    // usa a primeira planilha que tenha o cabeçalho da tabela
    grid = (sheets.find((s) => extractSheetRows(s.data as SheetCell[][]).rows.length > 0) ?? sheets[0])?.data as SheetCell[][] ?? [];
  } else {
    grid = parseCsvText(new TextDecoder("utf-8").decode(data));
  }
  const { rows, problems, warnings } = extractSheetRows(grid);
  return { kind, rows, declaredTotal: null, declaredQuantity: null, pages: [], problems, warnings };
}

export async function parseReport(data: Uint8Array, fileName: string): Promise<ParsedReport> {
  const kind = detectKind(data, fileName);
  return kind === "pdf" ? parsePdfReport(data) : parseSheetReport(data, kind);
}
