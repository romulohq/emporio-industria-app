import { StatusBadge } from "@/components/orders/status-badge";
import { PriorityBadge } from "@/components/orders/priority-badge";
import { updateOrderStatus } from "@/app/(app)/pedidos/actions";
import { STATUS_LABELS, STATUS_ORDER, formatDateTime, formatQuantity } from "@/lib/format/labels";
import type { Product, ProductionOrder, Sector } from "@/lib/types/database.types";

export function OrderTable({
  orders,
  productsById,
  sectorsById,
}: {
  orders: ProductionOrder[];
  productsById: Record<string, Product>;
  sectorsById: Record<string, Sector>;
}) {
  if (orders.length === 0) {
    return <p className="text-sm text-neutral-500">Nenhuma ordem de produção encontrada.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
          <tr>
            <th className="px-4 py-2">Produto</th>
            <th className="px-4 py-2">Setor</th>
            <th className="px-4 py-2">Quantidade</th>
            <th className="px-4 py-2">Prioridade</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Criada em</th>
            <th className="px-4 py-2">Atualizar status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const product = productsById[order.product_id];
            return (
              <tr key={order.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-medium text-neutral-900">
                  {product?.name ?? "—"}
                </td>
                <td className="px-4 py-2">{sectorsById[order.sector_id]?.name ?? "—"}</td>
                <td className="px-4 py-2">
                  {product ? formatQuantity(order.quantity, product.unit) : order.quantity}
                </td>
                <td className="px-4 py-2">
                  <PriorityBadge priority={order.priority} />
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-4 py-2 text-neutral-500">{formatDateTime(order.created_at)}</td>
                <td className="px-4 py-2">
                  {order.status === "completed" || order.status === "cancelled" ? (
                    <span className="text-neutral-400">—</span>
                  ) : (
                    <form action={updateOrderStatus} className="flex items-center gap-2">
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
                        className="rounded-md bg-amber-700 px-2 py-1 text-xs text-white hover:bg-amber-800"
                      >
                        Aplicar
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
