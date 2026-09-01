import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LowStockBadge } from "@/components/products/low-stock-badge";
import { formatQuantity } from "@/lib/format/labels";
import type { Product, Sector } from "@/lib/types/database.types";

export default async function EstoquePage() {
  const supabase = await createClient();

  const [{ data: products }, { data: sectors }] = await Promise.all([
    supabase.from("products").select("*").eq("active", true).order("name"),
    supabase.from("sectors").select("*").order("name"),
  ]);

  const sectorsById = Object.fromEntries(((sectors ?? []) as Sector[]).map((s) => [s.id, s]));
  const items = (products ?? []) as Product[];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-neutral-900">Estoque</h1>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Produto</th>
              <th className="px-4 py-2">Setor</th>
              <th className="px-4 py-2">Estoque atual</th>
              <th className="px-4 py-2">Mínimo</th>
              <th className="px-4 py-2">Situação</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((product) => (
              <tr key={product.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-medium text-neutral-900">{product.name}</td>
                <td className="px-4 py-2">{sectorsById[product.sector_id]?.name ?? "—"}</td>
                <td className="px-4 py-2">{formatQuantity(product.current_quantity, product.unit)}</td>
                <td className="px-4 py-2">{formatQuantity(product.min_quantity, product.unit)}</td>
                <td className="px-4 py-2">
                  <LowStockBadge isLow={product.is_low_stock} />
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/estoque/${product.id}/movimentar`}
                    className="text-amber-700 hover:underline"
                  >
                    Movimentar
                  </Link>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                  Nenhum produto ativo encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
