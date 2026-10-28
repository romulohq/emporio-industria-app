import { buildOrderRow, columnForLabel, type ColumnKey, type RawCells } from "@/lib/erp/columns";
import type { ErpOrderRow, ParseProblem } from "@/lib/erp/types";

export type SheetCell = string | number | boolean | Date | null | undefined;

/** Divide uma linha de CSV respeitando aspas. */
function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else current += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      out.push(current);
      current = "";
    } else current += ch;
  }
  out.push(current);
  return out;
}

export function parseCsvText(text: string): string[][] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const head = lines[0];
  const delimiter = (head.match(/;/g)?.length ?? 0) >= (head.match(/,/g)?.length ?? 0) ? ";" : ",";
  return lines.map((l) => splitCsvLine(l, delimiter));
}

/** Linhas de planilha (xlsx ou csv) com a mesma tabela do relatório: acha o cabeçalho pelos títulos das colunas. */
export function extractSheetRows(grid: SheetCell[][]): {
  rows: ErpOrderRow[];
  problems: ParseProblem[];
  warnings: string[];
} {
  const rows: ErpOrderRow[] = [];
  const problems: ParseProblem[] = [];
  const warnings: string[] = [];

  let headerIndex = -1;
  let columns = new Map<number, ColumnKey>();
  for (let i = 0; i < Math.min(grid.length, 30); i++) {
    const found = new Map<number, ColumnKey>();
    grid[i].forEach((cell, col) => {
      const key = typeof cell === "string" ? columnForLabel(cell) : null;
      if (key && ![...found.values()].includes(key)) found.set(col, key);
    });
    if (found.size >= 8) {
      headerIndex = i;
      columns = found;
      break;
    }
  }
  if (headerIndex < 0) {
    problems.push({ page: null, row: null, message: "cabeçalho da tabela não encontrado (colunas Empresa, N. Ordem, Situação…)" });
    return { rows, problems, warnings };
  }

  for (let i = headerIndex + 1; i < grid.length; i++) {
    const line = grid[i];
    if (line.every((c) => c == null || String(c).trim() === "")) continue;
    const cells: RawCells = {};
    for (const [col, key] of columns) {
      const value = line[col];
      cells[key] = typeof value === "boolean" ? String(value) : (value ?? null);
    }
    // linha de total / rodapé: sem número de ordem
    if (cells.orderNumber == null || String(cells.orderNumber).trim() === "") continue;
    const built = buildOrderRow(cells, null);
    if ("error" in built) problems.push({ page: null, row: i + 1, message: built.error });
    else {
      rows.push(built.row);
      for (const warning of built.warnings) if (!warnings.includes(warning)) warnings.push(warning);
    }
  }
  return { rows, problems, warnings };
}
