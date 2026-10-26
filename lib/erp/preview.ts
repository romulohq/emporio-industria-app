import { z } from "zod";
import type { Analysis, ImportOptions, MonthSummary, PreviewOrder } from "@/lib/erp/analyze";
import type { ErpFileKind, Integrity, ParsedReport } from "@/lib/erp/types";

/** Resposta da leitura do arquivo (só dados simples, para ir como JSON até a tela). */
export type ErpPreview = {
  fileName: string;
  kind: ErpFileKind;
  units: string[];
  period: { start: string | null; end: string | null };
  totalRows: number;
  declaredTotal: number | null;
  integrity: Integrity;
  pages: { page: number; rowsRead: number; problems: number }[];
  parserWarnings: string[];
  months: MonthSummary[];
  statusCounts: { status: string; count: number }[];
  unknownCodes: { code: string; description: string; orders: number }[];
  nonConcluded: PreviewOrder[];
  outliers: (PreviewOrder & { median: number; ratio: number })[];
  existing: { count: number; changed: { key: string; orderNumber: number; changes: string[] }[] };
};

export type ErpImportResult = {
  importId: string;
  rowsTotal: number;
  inserted: number;
  updated: number;
  excluded: number;
  withWarning: number;
  period: { start: string | null; end: string | null };
};

export function periodOf(parsed: ParsedReport): { start: string | null; end: string | null } {
  const dates = parsed.rows.map((r) => r.launchDate).sort();
  return { start: dates[0] ?? null, end: dates[dates.length - 1] ?? null };
}

export function buildPreview(
  fileName: string,
  parsed: ParsedReport,
  integrity: Integrity,
  analysis: Analysis
): ErpPreview {
  return {
    fileName,
    kind: parsed.kind,
    units: [...new Set(parsed.rows.map((r) => r.unit))],
    period: periodOf(parsed),
    totalRows: parsed.rows.length,
    declaredTotal: parsed.declaredTotal,
    integrity,
    pages: parsed.pages,
    parserWarnings: parsed.warnings,
    months: analysis.months,
    statusCounts: analysis.statusCounts,
    unknownCodes: analysis.unknownCodes,
    nonConcluded: analysis.nonConcluded,
    outliers: analysis.outliers,
    existing: analysis.existing,
  };
}

export const importOptionsSchema: z.ZodType<ImportOptions> = z.object({
  includeStatuses: z.array(z.string().max(60)).max(20),
  overrides: z
    .array(
      z.object({
        key: z.string().max(200),
        quantity: z.number().finite().nonnegative().nullable().optional(),
        excluded: z.boolean().optional(),
      })
    )
    .max(5000),
});

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Lê o arquivo enviado (multipart) com limite de tamanho. */
export async function readUpload(
  request: Request
): Promise<{ data: Uint8Array; fileName: string; form: FormData } | { error: string }> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { error: "Envio inválido." };
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha um arquivo (PDF, XLSX ou CSV)." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "Arquivo grande demais (limite de 4 MB)." };
  return { data: new Uint8Array(await file.arrayBuffer()), fileName: file.name, form };
}
