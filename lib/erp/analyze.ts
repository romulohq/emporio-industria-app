import { normalizeText } from "@/lib/erp/br";
import { orderKey, type ErpOrderRow } from "@/lib/erp/types";

export const OUTLIER_FACTOR = 10;
/** Com menos ordens que isso a mediana não diz nada — não se sinaliza quantidade fora do normal. */
export const OUTLIER_MIN_SAMPLE = 3;

export function isConcluded(status: string): boolean {
  return normalizeText(status) === "CONCLUIDO";
}

export type CatalogInfo = { unitWeightKg: number | null; unitMeasure: string | null };

export type ExistingOrder = {
  key: string;
  productCode: string;
  launchDate: string;
  quantity: number;
  unitCost: number | null;
  status: string;
};

export type HistoryOrder = { key: string; productCode: string; quantity: number };

export type AnalysisContext = {
  catalog: Map<string, CatalogInfo>;
  /** ordens já gravadas (não excluídas) dos produtos do arquivo — a base da mediana, além do próprio arquivo */
  history: HistoryOrder[];
  /** ordens do arquivo que já existem no banco */
  existing: Map<string, ExistingOrder>;
};

export type PreviewOrder = {
  key: string;
  orderNumber: number;
  productCode: string;
  description: string;
  launchDate: string;
  quantity: number;
  unitMeasure: string;
  status: string;
};

export type MonthSummary = {
  month: string;
  orders: number;
  units: number;
  kg: number;
  /** ordens em unidade cujo produto não tem peso cadastrado (ficam fora do total em kg) */
  withoutWeight: number;
};

export type Analysis = {
  months: MonthSummary[];
  statusCounts: { status: string; count: number }[];
  unknownCodes: { code: string; description: string; orders: number }[];
  nonConcluded: PreviewOrder[];
  outliers: (PreviewOrder & { median: number; ratio: number })[];
  existing: { count: number; changed: { key: string; orderNumber: number; changes: string[] }[] };
  /** ordens com qualquer aviso (sem cadastro, não concluída ou fora do normal) */
  flaggedKeys: Set<string>;
};

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function toPreview(row: ErpOrderRow): PreviewOrder {
  return {
    key: orderKey(row),
    orderNumber: row.orderNumber,
    productCode: row.productCode,
    description: row.description,
    launchDate: row.launchDate,
    quantity: row.quantity,
    unitMeasure: row.unitMeasure,
    status: row.status,
  };
}

export function summarizeByMonth(rows: ErpOrderRow[], catalog: Map<string, CatalogInfo>): MonthSummary[] {
  const months = new Map<string, MonthSummary>();
  for (const row of rows) {
    const month = row.launchDate.slice(0, 7);
    const summary = months.get(month) ?? { month, orders: 0, units: 0, kg: 0, withoutWeight: 0 };
    summary.orders += 1;
    if (row.unitMeasure === "KG") {
      summary.kg += row.quantity;
    } else {
      summary.units += row.quantity;
      const weight = catalog.get(row.productCode)?.unitWeightKg;
      if (weight != null) summary.kg += row.quantity * weight;
      else summary.withoutWeight += 1;
    }
    months.set(month, summary);
  }
  return [...months.values()]
    .map((m) => ({ ...m, kg: Math.round(m.kg * 1000) / 1000, units: Math.round(m.units * 1000) / 1000 }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function analyzeRows(rows: ErpOrderRow[], ctx: AnalysisContext): Analysis {
  const flaggedKeys = new Set<string>();
  const fileKeys = new Set(rows.map(orderKey));

  const statusMap = new Map<string, number>();
  for (const row of rows) statusMap.set(row.status, (statusMap.get(row.status) ?? 0) + 1);
  const statusCounts = [...statusMap.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const unknown = new Map<string, { code: string; description: string; orders: number }>();
  for (const row of rows) {
    if (ctx.catalog.has(row.productCode)) continue;
    const entry = unknown.get(row.productCode) ?? { code: row.productCode, description: row.description, orders: 0 };
    entry.orders += 1;
    unknown.set(row.productCode, entry);
    flaggedKeys.add(orderKey(row));
  }

  const nonConcluded = rows.filter((r) => !isConcluded(r.status)).map(toPreview);
  for (const order of nonConcluded) flaggedKeys.add(order.key);

  const quantitiesByProduct = new Map<string, number[]>();
  for (const row of rows) {
    const list = quantitiesByProduct.get(row.productCode) ?? [];
    list.push(row.quantity);
    quantitiesByProduct.set(row.productCode, list);
  }
  for (const old of ctx.history) {
    if (fileKeys.has(old.key)) continue; // será substituída pela versão do arquivo
    const list = quantitiesByProduct.get(old.productCode);
    if (list) list.push(old.quantity);
  }
  const outliers: Analysis["outliers"] = [];
  for (const row of rows) {
    const sample = quantitiesByProduct.get(row.productCode) ?? [];
    if (sample.length < OUTLIER_MIN_SAMPLE) continue;
    const mid = median(sample);
    if (mid > 0 && row.quantity > OUTLIER_FACTOR * mid) {
      outliers.push({ ...toPreview(row), median: mid, ratio: row.quantity / mid });
      flaggedKeys.add(orderKey(row));
    }
  }

  const changed: Analysis["existing"]["changed"] = [];
  let existingCount = 0;
  for (const row of rows) {
    const old = ctx.existing.get(orderKey(row));
    if (!old) continue;
    existingCount += 1;
    const changes: string[] = [];
    if (old.quantity !== row.quantity) changes.push(`quantidade ${old.quantity} → ${row.quantity}`);
    if (old.status !== row.status) changes.push(`situação ${old.status} → ${row.status}`);
    if (old.launchDate !== row.launchDate) changes.push(`data ${old.launchDate} → ${row.launchDate}`);
    if (old.productCode !== row.productCode) changes.push(`item ${old.productCode} → ${row.productCode}`);
    if (old.unitCost != null && old.unitCost !== row.unitCost) changes.push(`custo ${old.unitCost} → ${row.unitCost}`);
    if (changes.length) changed.push({ key: orderKey(row), orderNumber: row.orderNumber, changes });
  }

  return {
    months: summarizeByMonth(rows, ctx.catalog),
    statusCounts,
    unknownCodes: [...unknown.values()].sort((a, b) => a.code.localeCompare(b.code)),
    nonConcluded,
    outliers,
    existing: { count: existingCount, changed },
    flaggedKeys,
  };
}

/** Peso por unidade sugerido a partir da descrição: "100G" = 0,100 kg, "90 G" = 0,090 kg, "1,5KG" = 1,5 kg. UM KG = 1. */
export function suggestWeightKg(description: string, unitMeasure: string | null): number | null {
  if (unitMeasure === "KG") return 1;
  const match = description.toUpperCase().match(/(?<![A-Z0-9,.])(\d+(?:[.,]\d+)?)\s*(KG|GR|G)(?![A-Z0-9])/);
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const kg = match[2] === "KG" ? amount : amount / 1000;
  return Math.round(kg * 10000) / 10000;
}

// -- opções da importação ------------------------------------------------------------------------------

export type ImportOptions = {
  /** situações diferentes de CONCLUÍDO que o admin escolheu incluir (texto como veio) */
  includeStatuses: string[];
  /** correções por ordem: nova quantidade e/ou exclusão */
  overrides: { key: string; quantity?: number | null; excluded?: boolean }[];
};

export type ImportRow = ErpOrderRow & { excluded: boolean; note: string | null };

export function applyImportOptions(rows: ErpOrderRow[], options: ImportOptions): ImportRow[] {
  const overrides = new Map(options.overrides.map((o) => [o.key, o]));
  const included = new Set(options.includeStatuses.map(normalizeText));

  return rows.map((row) => {
    const override = overrides.get(orderKey(row));
    const notes: string[] = [];
    let quantity = row.quantity;
    let excluded = false;

    if (override?.quantity != null && Number.isFinite(override.quantity) && override.quantity >= 0 && override.quantity !== row.quantity) {
      notes.push(`Quantidade corrigida na importação (ERP: ${row.quantity})`);
      quantity = override.quantity;
    }
    if (override?.excluded) {
      excluded = true;
      notes.push("Linha excluída na importação");
    }
    if (!isConcluded(row.status) && !included.has(normalizeText(row.status))) {
      excluded = true;
      notes.push(`Situação ${row.status}: não incluída na importação`);
    }

    return { ...row, quantity, excluded, note: notes.length ? notes.join("; ") : null };
  });
}
