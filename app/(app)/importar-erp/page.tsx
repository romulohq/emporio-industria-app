import { requireAdmin } from "@/lib/auth/get-session";
import { ImportErp } from "@/components/erp/import-erp";
import { MonthlyTotals } from "@/components/erp/monthly-totals";
import { createClient } from "@/lib/supabase/server";
import { formatDateBR } from "@/lib/erp/br";
import { formatDateTime } from "@/lib/format/labels";
import { accumulateByMonth, type StoredOrder } from "@/lib/erp/monthly";
import { fetchAll, loadCatalog } from "@/lib/erp/queries";
import type { ErpImport } from "@/lib/types/database.types";

export default async function ImportarErpPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("erp_imports").select("*").order("created_at", { ascending: false }).limit(50);
  const imports = (data ?? []) as ErpImport[];

  const [orders, catalogRows] = await Promise.all([
    fetchAll<StoredOrder>((from, to) =>
      supabase
        .from("erp_production_orders")
        .select("product_code, erp_description, launch_date, quantity, unit_measure, status")
        .eq("excluded", false)
        .order("id")
        .range(from, to)
    ),
    loadCatalog(),
  ]);
  const catalog = new Map(catalogRows.map((c) => [c.product_code, { displayName: c.display_name, unitWeightKg: c.unit_weight_kg }]));
  const months = accumulateByMonth(orders, catalog);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Importar relatório do ERP</h1>
        <p className="text-sm text-neutral-500">
          Ordens de Produção do Everest 3.0 (Fábrica Congelados). Alimenta a aba Produtividade.
        </p>
      </div>

      <ImportErp />

      <MonthlyTotals months={months} />

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-neutral-900">Histórico das importações</h2>
        {imports.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma importação ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Arquivo</th>
                  <th className="px-3 py-2">Período</th>
                  <th className="px-3 py-2 text-right">Ordens</th>
                  <th className="px-3 py-2 text-right">Novas</th>
                  <th className="px-3 py-2 text-right">Atualizadas</th>
                  <th className="px-3 py-2 text-right">Com aviso</th>
                  <th className="px-3 py-2">Importado por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {imports.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap px-3 py-2">{formatDateTime(item.created_at)}</td>
                    <td className="px-3 py-2">{item.file_name}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {formatDateBR(item.period_start)} a {formatDateBR(item.period_end)}
                    </td>
                    <td className="px-3 py-2 text-right">{item.rows_total}</td>
                    <td className="px-3 py-2 text-right">{item.rows_inserted}</td>
                    <td className="px-3 py-2 text-right">{item.rows_updated}</td>
                    <td className="px-3 py-2 text-right">{item.rows_with_warning}</td>
                    <td className="px-3 py-2">{item.imported_by_name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
