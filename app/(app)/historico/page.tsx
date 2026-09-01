import { createClient } from "@/lib/supabase/server";
import { MOVEMENT_LABELS } from "@/lib/format/labels";
import { formatDateTime, formatQuantity } from "@/lib/format/labels";
import type { Product, Sector, StockMovement } from "@/lib/types/database.types";

const TONE: Record<StockMovement["movement_type"], string> = {
  entry: "text-green-700",
  exit: "text-red-700",
  adjustment: "text-amber-700",
};

export default async function HistoricoPage() {
  const supabase = await createClient();

  const [{ data: movements }, { data: products }, { data: sectors }] = await Promise.all([
    supabase
      .from("stock_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("products").select("*"),
    supabase.from("sectors").select("*"),
  ]);

  const productsById = Object.fromEntries(((products ?? []) as Product[]).map((p) => [p.id, p]));
  const sectorsById = Object.fromEntries(((sectors ?? []) as Sector[]).map((s) => [s.id, s]));
  const items = (movements ?? []) as StockMovement[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Histórico de movimentações</h1>
        <p className="text-sm text-neutral-500">Últimos 200 lançamentos, mais recentes primeiro.</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Data</th>
              <th className="px-4 py-2">Produto</th>
              <th className="px-4 py-2">Setor</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Quantidade</th>
              <th className="px-4 py-2">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((movement) => {
              const product = productsById[movement.product_id];
              return (
                <tr key={movement.id} className="border-t border-neutral-100">
                  <td className="px-4 py-2 text-neutral-500">{formatDateTime(movement.created_at)}</td>
                  <td className="px-4 py-2 font-medium text-neutral-900">{product?.name ?? "—"}</td>
                  <td className="px-4 py-2">{sectorsById[movement.sector_id]?.name ?? "—"}</td>
                  <td className={`px-4 py-2 font-medium ${TONE[movement.movement_type]}`}>
                    {MOVEMENT_LABELS[movement.movement_type]}
                  </td>
                  <td className="px-4 py-2">
                    {product ? formatQuantity(movement.quantity, product.unit) : movement.quantity}
                  </td>
                  <td className="px-4 py-2 text-neutral-500">{movement.reason ?? "—"}</td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                  Nenhuma movimentação registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
