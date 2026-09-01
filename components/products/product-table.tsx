import Link from "next/link";
import { LowStockBadge } from "@/components/products/low-stock-badge";
import { Badge } from "@/components/ui/badge";
import { formatQuantity } from "@/lib/format/labels";
import type { Product, Sector } from "@/lib/types/database.types";

export function ProductTable({
  products,
  sectorsById,
}: {
  products: Product[];
  sectorsById: Record<string, Sector>;
}) {
  if (products.length === 0) {
    return <p className="text-sm text-neutral-500">Nenhum produto cadastrado ainda.</p>;
  }

  return (
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
          {products.map((product) => (
            <tr key={product.id} className="border-t border-neutral-100">
              <td className="px-4 py-2">
                <div className="font-medium text-neutral-900">{product.name}</div>
                {product.sku && <div className="text-xs text-neutral-500">SKU {product.sku}</div>}
              </td>
              <td className="px-4 py-2">{sectorsById[product.sector_id]?.name ?? "—"}</td>
              <td className="px-4 py-2">{formatQuantity(product.current_quantity, product.unit)}</td>
              <td className="px-4 py-2">{formatQuantity(product.min_quantity, product.unit)}</td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <LowStockBadge isLow={product.is_low_stock} />
                  {!product.active && <Badge tone="neutral">Inativo</Badge>}
                </div>
              </td>
              <td className="px-4 py-2 text-right">
                <Link href={`/produtos/${product.id}`} className="text-amber-700 hover:underline">
                  Editar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
