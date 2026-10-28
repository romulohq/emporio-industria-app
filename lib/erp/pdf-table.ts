import { parseBrNumber } from "@/lib/erp/br";
import { buildOrderRow, columnForLabel, type ColumnKey, type RawCells } from "@/lib/erp/columns";
import type { ErpOrderRow, ParseProblem } from "@/lib/erp/types";

/** Pedaço de texto já em coordenadas de tela (x para a direita, y para baixo), com a rotação da página aplicada. */
export type PdfTextItem = { str: string; x: number; y: number; width: number };

type Band = { key: ColumnKey; start: number; end: number };
type Cluster = { y: number; items: PdfTextItem[] };

const ROW_TOLERANCE = 2;
const ALIGN_TOLERANCE = 4;

/** "18 - FABRICA CONGELADOS" impresso na página (cabeçalho ou rodapé): código da empresa -> nome. */
export function unitNamesOnPage(items: PdfTextItem[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const item of items) {
    const parts = item.str.trim().split(" - ");
    if (parts.length >= 2 && /^\d+$/.test(parts[0]) && !names.has(parts[0])) names.set(parts[0], parts[parts.length - 1].trim());
  }
  return names;
}

export function clusterRows(items: PdfTextItem[]): Cluster[] {
  const sorted = items.filter((i) => i.str.trim() !== "").sort((a, b) => a.y - b.y || a.x - b.x);
  const clusters: Cluster[] = [];
  for (const item of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(item.y - last.y) <= ROW_TOLERANCE) last.items.push(item);
    else clusters.push({ y: item.y, items: [item] });
  }
  for (const cluster of clusters) cluster.items.sort((a, b) => a.x - b.x);
  return clusters;
}

/** Lê os títulos do cabeçalho (um título pode vir quebrado em vários pedaços) e devolve a faixa de cada coluna. */
export function detectHeader(cluster: Cluster): Band[] | null {
  const items = cluster.items;
  const bands: Band[] = [];
  let i = 0;
  while (i < items.length) {
    let matched = false;
    for (let len = Math.min(4, items.length - i); len >= 1; len--) {
      const slice = items.slice(i, i + len);
      const key = columnForLabel(slice.map((s) => s.str).join(" "));
      if (key && !bands.some((b) => b.key === key)) {
        const last = slice[slice.length - 1];
        bands.push({ key, start: slice[0].x, end: last.x + last.width });
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) i += 1;
  }
  const keys = new Set(bands.map((b) => b.key));
  return bands.length >= 8 && keys.has("orderNumber") && keys.has("status") ? bands : null;
}

/**
 * Em cada coluna o texto alinha pelo início (texto) ou pelo fim (números à direita) com o título.
 * A coluna escolhida é a que tem o início ou o fim mais perto — fora da tolerância, o texto é ignorado
 * (rodapé, paginação, filtro).
 */
export function assignColumn(item: PdfTextItem, bands: Band[]): ColumnKey | null {
  let best: ColumnKey | null = null;
  let bestDistance = Infinity;
  for (const band of bands) {
    const distance = Math.min(Math.abs(item.x - band.start), Math.abs(item.x + item.width - band.end));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = band.key;
    }
  }
  return bestDistance <= ALIGN_TOLERANCE ? best : null;
}

function joinCell(items: PdfTextItem[]): string {
  let out = "";
  let previousEnd: number | null = null;
  for (const item of items) {
    if (previousEnd !== null && item.x - previousEnd > 0.8 && !out.endsWith(" ")) out += " ";
    out += item.str;
    previousEnd = item.x + item.width;
  }
  return out.replace(/\s+/g, " ").trim();
}

export type PageResult = {
  page: number;
  bands: Band[] | null;
  rows: ErpOrderRow[];
  problems: ParseProblem[];
  warnings: string[];
  declaredTotal: number | null;
  /** soma de "Total Produção" impressa na linha de total */
  declaredQuantity: number | null;
};

/** Converte os textos de uma página em ordens. `inheritedBands` cobre páginas sem cabeçalho repetido. */
export function extractPageRows(items: PdfTextItem[], page: number, inheritedBands: Band[] | null): PageResult {
  const clusters = clusterRows(items);
  let bands = inheritedBands;
  let headerIndex = -1;
  for (let i = 0; i < clusters.length; i++) {
    const found = detectHeader(clusters[i]);
    if (found) {
      bands = found;
      headerIndex = i;
      break;
    }
  }

  const result: PageResult = { page, bands, rows: [], problems: [], warnings: [], declaredTotal: null, declaredQuantity: null };
  if (!bands) {
    if (items.length > 0) result.problems.push({ page, row: null, message: "cabeçalho da tabela não encontrado" });
    return result;
  }

  const unitNames = unitNamesOnPage(items);
  let rowNumber = 0;
  for (const cluster of clusters.slice(headerIndex + 1)) {
    const cells: Partial<Record<ColumnKey, PdfTextItem[]>> = {};
    for (const item of cluster.items) {
      const key = assignColumn(item, bands);
      if (key) (cells[key] ??= []).push(item);
    }
    const assigned = Object.keys(cells).length;

    if (cells.orderNumber) {
      rowNumber += 1;
      const raw: RawCells = {};
      for (const [key, parts] of Object.entries(cells) as [ColumnKey, PdfTextItem[]][]) raw[key] = joinCell(parts);
      const built = buildOrderRow(raw, page, unitNames.get(String(raw.company ?? "")));
      if ("error" in built) {
        result.problems.push({ page, row: rowNumber, message: built.error });
      } else {
        result.rows.push(built.row);
        result.warnings.push(...built.warnings);
      }
      continue;
    }

    // linha de total: o número de ordens na coluna Empresa, mais as somas de produção e custo
    if (cells.company && !cells.productCode && !cells.description && !cells.launchDate && !cells.status) {
      const count = joinCell(cells.company);
      if (/^\d+$/.test(count)) {
        result.declaredTotal = Number(count);
        result.declaredQuantity = cells.quantity ? parseBrNumber(joinCell(cells.quantity)) : null;
        continue;
      }
    }

    // total solto (só o número de ordens, sem as somas)
    if (cluster.items.length === 1 && /^\d+$/.test(cluster.items[0].str.trim())) {
      result.declaredTotal = Number(cluster.items[0].str.trim());
      continue;
    }

    // algo que parece parte de uma ordem mas sem o número da ordem
    if (assigned >= 3) {
      rowNumber += 1;
      result.problems.push({
        page,
        row: rowNumber,
        message: `linha sem número de ordem: "${cluster.items.map((i) => i.str).join(" ").slice(0, 80)}"`,
      });
    }
  }
  return result;
}
