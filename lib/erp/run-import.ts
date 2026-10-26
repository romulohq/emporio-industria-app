import "server-only";
import { randomUUID } from "node:crypto";
import { analyzeRows, applyImportOptions, type ImportOptions } from "@/lib/erp/analyze";
import { checkIntegrity } from "@/lib/erp/integrity";
import { parseReport } from "@/lib/erp/parse-report";
import { periodOf, type ErpImportResult } from "@/lib/erp/preview";
import { loadAnalysisContext } from "@/lib/erp/queries";
import { orderKey, type ErpFileKind } from "@/lib/erp/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const ERP_BUCKET = "erp-reports";

export class ImportError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: string[] = []
  ) {
    super(message);
  }
}

function safeFileName(name: string): string {
  const clean = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_");
  return clean.slice(-80) || "relatorio";
}

function contentTypeOf(kind: ErpFileKind): string {
  if (kind === "pdf") return "application/pdf";
  if (kind === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "text/csv";
}

/**
 * Importa o arquivo: lê de novo no servidor, confere o total, guarda o original no Storage, registra a importação
 * e grava as ordens (upsert por unidade + número da ordem). Quem chama já checou que o usuário é admin.
 */
export async function runImport(args: {
  data: Uint8Array;
  fileName: string;
  options: ImportOptions;
  importedBy: { id: string; name: string | null };
}): Promise<ErpImportResult> {
  const parsed = await parseReport(args.data, args.fileName);
  const integrity = checkIntegrity(parsed);
  if (!integrity.ok) {
    throw new ImportError("A conferência do total falhou — importação bloqueada.", 422, integrity.messages);
  }

  const admin = createAdminClient();
  const context = await loadAnalysisContext(parsed.rows);
  const analysis = analyzeRows(parsed.rows, context);
  const rows = applyImportOptions(parsed.rows, args.options);
  const period = periodOf(parsed);

  const importId = randomUUID();
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const filePath = `${now.getUTCFullYear()}/${stamp}-${safeFileName(args.fileName)}`;

  const stored = await admin.storage.from(ERP_BUCKET).upload(filePath, Buffer.from(args.data), {
    contentType: contentTypeOf(parsed.kind),
    upsert: false,
  });
  if (stored.error) {
    console.error("erp import: falha ao guardar o arquivo", stored.error);
    throw new ImportError("Não foi possível guardar o arquivo original. Nada foi importado.", 500);
  }

  const inserted = rows.filter((r) => !context.existing.has(orderKey(r))).length;
  const updated = rows.length - inserted;
  const withWarning = rows.filter((r) => analysis.flaggedKeys.has(orderKey(r))).length;

  const created = await admin.from("erp_imports").insert({
    id: importId,
    file_name: args.fileName,
    file_path: filePath,
    unit: [...new Set(rows.map((r) => r.unit))].join("; "),
    period_start: period.start,
    period_end: period.end,
    rows_total: rows.length,
    rows_inserted: inserted,
    rows_updated: updated,
    rows_with_warning: withWarning,
    imported_by: args.importedBy.id,
    imported_by_name: args.importedBy.name,
  });
  if (created.error) {
    await admin.storage.from(ERP_BUCKET).remove([filePath]);
    console.error("erp import: falha ao registrar a importação", created.error);
    throw new ImportError("Não foi possível registrar a importação. Nada foi importado.", 500);
  }

  const payload = rows.map((r) => ({
    unit: r.unit,
    order_number: r.orderNumber,
    product_code: r.productCode,
    erp_description: r.description,
    packaging: r.packaging,
    unit_measure: r.unitMeasure,
    item_type: r.itemType,
    launch_date: r.launchDate,
    quantity: r.quantity,
    unit_cost: r.unitCost,
    status: r.status,
    excluded: r.excluded,
    note: r.note,
    import_id: importId,
  }));
  for (let i = 0; i < payload.length; i += 500) {
    const result = await admin.from("erp_production_orders").upsert(payload.slice(i, i + 500), { onConflict: "unit,order_number" });
    if (result.error) {
      console.error("erp import: falha ao gravar as ordens", result.error);
      throw new ImportError(
        `Falha ao gravar as ordens (lote ${i / 500 + 1}). Importe o arquivo de novo — as ordens já gravadas serão atualizadas, não duplicadas.`,
        500
      );
    }
  }

  return {
    importId,
    rowsTotal: rows.length,
    inserted,
    updated,
    excluded: rows.filter((r) => r.excluded).length,
    withWarning,
    period,
  };
}
