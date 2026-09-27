import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-session";
import { PrintButton } from "@/components/orders/print-button";
import { weekdayOfISODate, formatBrDate } from "@/lib/dates";
import { WEEKDAY_LABELS, formatQuantity } from "@/lib/format/labels";
import type { Product, ProductionOrder, Sector } from "@/lib/types/database.types";

export default async function ImprimirOrdemDoSetorPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; sector?: string }>;
}) {
  await requireUser();
  const { date, sector: sectorId } = await searchParams;
  const supabase = await createClient();

  if (!date || !sectorId) {
    return <p className="p-6 text-sm text-neutral-500">Informe data e setor (?date=AAAA-MM-DD&sector=ID) na URL.</p>;
  }

  const [{ data: sector }, { data: orders }] = await Promise.all([
    supabase.from("sectors").select("*").eq("id", sectorId).single(),
    supabase
      .from("production_orders")
      .select("*")
      .eq("source", "auto_route")
      .eq("delivery_date", date)
      .eq("sector_id", sectorId)
      .in("status", ["pending", "in_progress", "completed"]),
  ]);

  const ordersList = (orders ?? []) as ProductionOrder[];
  const productIds = ordersList.map((o) => o.product_id);
  const { data: products } = productIds.length
    ? await supabase.from("products").select("*").in("id", productIds)
    : { data: [] as Product[] };
  const productsById = Object.fromEntries(((products ?? []) as Product[]).map((p) => [p.id, p]));

  const sortedOrders = [...ordersList].sort((a, b) =>
    (productsById[a.product_id]?.name ?? "").localeCompare(productsById[b.product_id]?.name ?? "")
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/pedidos/dia" className="text-sm font-medium text-orange-700 hover:text-orange-800">
          ← Voltar
        </Link>
        <PrintButton />
      </div>

      <header className="space-y-1 border-b-2 border-orange-600 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 text-xs font-extrabold text-white">
            EP
          </span>
          <span className="text-sm font-extrabold text-neutral-900">Empório do Pão — Unidade Rui Barbosa</span>
        </div>
        <h1 className="text-2xl font-bold text-neutral-900">
          Ordem de produção — {(sector as Sector | null)?.name ?? "—"}
        </h1>
        <p className="text-sm text-neutral-600">
          {WEEKDAY_LABELS[weekdayOfISODate(date)]}, {formatBrDate(date)}
        </p>
        {(sector as Sector | null)?.responsible_name && (
          <p className="text-sm text-neutral-600">
            Responsável: <span className="font-semibold text-neutral-900">{(sector as Sector).responsible_name}</span>
          </p>
        )}
      </header>

      {sortedOrders.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum pedido para este setor nesta data.</p>
      ) : (
        <table className="w-full border-collapse text-base">
          <thead>
            <tr className="bg-orange-50">
              <th className="border border-orange-100 px-3 py-2 text-left font-semibold text-neutral-900">
                Produto
              </th>
              <th className="border border-orange-100 px-3 py-2 text-right font-semibold text-neutral-900">
                Quantidade
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedOrders.map((order) => {
              const product = productsById[order.product_id];
              return (
                <tr key={order.id} className="even:bg-neutral-50">
                  <td className="border border-neutral-200 px-3 py-2 font-medium text-neutral-900">
                    {product?.name ?? "—"}
                  </td>
                  <td className="border border-neutral-200 px-3 py-2 text-right font-bold text-neutral-900">
                    {product ? formatQuantity(order.quantity, product.unit) : order.quantity}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
