import type { Integrity, ParsedReport } from "@/lib/erp/types";

/**
 * O PDF traz o total de ordens no rodapé da última página. Se as linhas lidas não batem com ele (ou alguma
 * linha ficou ilegível), a importação é bloqueada — e as páginas suspeitas são listadas.
 */
export function checkIntegrity(report: ParsedReport): Integrity {
  const messages: string[] = [];
  const bad = new Set<number>();

  if (report.rows.length === 0) messages.push("Nenhuma ordem foi encontrada no arquivo.");

  for (const problem of report.problems) {
    const where = problem.page != null ? `Página ${problem.page}` : problem.row != null ? `Linha ${problem.row}` : "Arquivo";
    const row = problem.page != null && problem.row != null ? `, linha ${problem.row}` : "";
    messages.push(`${where}${row}: ${problem.message}.`);
    if (problem.page != null) bad.add(problem.page);
  }

  if (report.declaredTotal != null && report.rows.length !== report.declaredTotal) {
    messages.push(
      `O relatório informa ${report.declaredTotal} ordens, mas foram lidas ${report.rows.length}.`
    );
    // páginas cheias (todas menos a última) devem ter a mesma quantidade de linhas
    const full = report.pages.slice(0, -1);
    const capacity = Math.max(0, ...full.map((p) => p.rowsRead));
    for (const page of full) {
      if (page.rowsRead < capacity) {
        bad.add(page.page);
        messages.push(`Página ${page.page}: ${page.rowsRead} linhas lidas, as outras páginas cheias têm ${capacity}.`);
      }
    }
  }

  if (report.declaredQuantity != null) {
    const sum = report.rows.reduce((total, row) => total + row.quantity, 0);
    if (Math.abs(sum - report.declaredQuantity) > 0.01) {
      messages.push(
        `A soma de "Total Produção" do relatório é ${report.declaredQuantity}, mas as linhas lidas somam ${Math.round(sum * 1e6) / 1e6}.`
      );
    }
  }

  return { ok: messages.length === 0, messages, badPages: [...bad].sort((a, b) => a - b) };
}
