import Link from "next/link";
import { Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-session";
import { StatusBadge } from "@/components/orders/status-badge";
import { PedidosTabs } from "@/components/orders/pedidos-tabs";
import { updateOrderStatus } from "@/app/(app)/pedidos/actions";
import { weekdayOfISODate, formatBrDate, fortalezaDateISO } from "@/lib/dates";
import { STATUS_LABELS, STATUS_ORDER, WEEKDAY_LABELS, formatQuantity } from "@/lib/format/labels";
import type { Product, ProductionOrder, ProductionOrderContribution, Sector, Store } from "@/lib/types/database.types";

export default async function HistoricoPedidosPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const todayISO = fortalezaDateISO();

  const [{ data: orders }, { data: sectors }, { data: products }] = await Promise.all([
    supabase
      .from("production_orders")
      .select("*")
      .eq("source", "auto_route")
      .in("status", ["pending", "in_progress", "completed"])
      .lte("delivery_date", todayISO)
      .order("delivery_date", { ascending: false })
      .limit(500),
    supabase.from("sectors").select("*"),
    supabase.from("products").select("*"),
  ]);

  const ordersList = (orders ?? []) as ProductionOrder[];
  const orderIds = ordersList.map((o) => o.id);
  const { data: contributions } = orderIds.length
    ? await supabase.from("production_order_contributions").select("*").in("order_id", orderIds)
    : { data: [] as ProductionOrderContribution[] };

  const storeIds = [...new Set((contributions ?? []).map((c) => c.store_id))];
  const { data: stores } = storeIds.length
    ? await supabase.from("stores").select("*").in("id", storeIds)
    : { data: [] as Store[] };

  const sectorsById = Object.fromEntries(((sectors ?? []) as Sector[]).map((s) => [s.id, s]));
  const productsById = Object.fromEntries(((products ?? []) as Product[]).map((p) => [p.id, p]));
  const storesById = Object.fromEntries(((stores ?? []) as Store[]).map((s) => [s.id, s]));

  const contributionsByOrder = new Map<string, ProductionOrderContribution[]>();
  for (const c of (contributions ?? []) as ProductionOrderContribution[]) {
    const list = contributionsByOrder.get(c.order_id) ?? [];
    list.push(c);
    contributionsByOrder.set(c.order_id, list);
  }

  // delivery_date -> sector -> orders
  const tree = new Map<string, Map<string, ProductionOrder[]>>();
  for (const order of ordersList) {
    if (!order.delivery_date) continue;
    const bySector = tree.get(order.delivery_date) ?? new Map<string, ProductionOrder[]>();
    const list = bySector.get(order.sector_id) ?? [];
    list.push(order);
    bySector.set(order.sector_id, list);
    tree.set(order.delivery_date, bySector);
  }

  const dateEntries = [...tree.entries()].sort(([a], [b]) => (a < b ? 1 : -1));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Pedidos — histórico</h1>
        <p className="text-sm text-neutral-500">
          Dias cuja entrega já chegou ou passou. Os últimos 500 pedidos automáticos.
        </p>
      </div>

      <PedidosTabs isAdmin={profile.is_admin} />

      {dateEntries.length === 0 && (
        <p className="text-sm text-neutral-500">Nenhum pedido no histórico ainda.</p>
      )}

      {dateEntries.map(([deliveryDate, bySector]) => (
        <div key={deliveryDate} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-900">
              Entrega — {WEEKDAY_LABELS[weekdayOfISODate(deliveryDate)]}, {formatBrDate(deliveryDate)}
            </h2>
            <div className="flex items-center gap-3">
              <Link
                href={`/pedidos/dia/imprimir?date=${deliveryDate}`}
                className="flex items-center gap-1 text-xs font-medium text-orange-700 hover:text-orange-800"
              >
                <Printer className="h-3.5 w-3.5" />
                Reimprimir
              </Link>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {[...bySector.entries()].map(([sectorId, sectorOrders]) => (
              <div key={sectorId} className="rounded-lg border border-neutral-200 bg-white">
                <div className="border-b border-neutral-100 px-4 py-3 font-semibold text-neutral-900">
                  {sectorsById[sectorId]?.name}
                </div>
                <div className="divide-y divide-neutral-100">
                  {sectorOrders.map((order) => {
                    const product = productsById[order.product_id];
                    const orderContributions = contributionsByOrder.get(order.id) ?? [];
                    return (
                      <div key={order.id} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-neutral-900">{product?.name ?? "—"}</span>
                          <span className="font-semibold text-neutral-900">
                            {product ? formatQuantity(order.quantity, product.unit) : order.quantity}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-neutral-500">
                          {orderContributions.map((c) => `${storesById[c.store_id]?.name ?? "?"} (${c.quantity})`).join(", ")}
                        </p>
                        <div className="mt-1 flex items-center justify-end">
                          <StatusBadge status={order.status} />
                        </div>
                        {profile.is_admin && (
                          <form action={updateOrderStatus} className="mt-2 flex items-center gap-2">
                            <input type="hidden" name="order_id" value={order.id} />
                            <select
                              name="status"
                              defaultValue={order.status}
                              className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
                            >
                              {STATUS_ORDER.map((status) => (
                                <option key={status} value={status}>
                                  {STATUS_LABELS[status]}
                                </option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              className="rounded-md bg-orange-600 px-2 py-1 text-xs text-white hover:bg-orange-700"
                            >
                              Aplicar
                            </button>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
