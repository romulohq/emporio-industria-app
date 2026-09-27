import { formatQuantity } from "@/lib/format/labels";
import type { Product, ProductionOrder } from "@/lib/types/database.types";

export function OrderQuantityTable({
  orders,
  productsById,
}: {
  orders: ProductionOrder[];
  productsById: Record<string, Product | undefined>;
}) {
  return (
    <table className="w-full border-collapse text-base">
      <thead>
        <tr className="bg-orange-50">
          <th className="border border-orange-100 px-3 py-2 text-left font-semibold text-neutral-900">Produto</th>
          <th className="border border-orange-100 px-3 py-2 text-right font-semibold text-neutral-900">
            Quantidade
          </th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => {
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
  );
}
