"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { correctStockReport } from "@/app/(app)/pedidos/respostas/actions";
import { cn } from "@/lib/utils";

export type ResponseItem = {
  reportId: string;
  storeId: string;
  productId: string;
  productName: string;
  sectorName: string;
  unit: string;
  quantity: number;
  minQuantity: number | null;
  toProduce: number | null;
};

export function ResponseSessionRow({
  storeName,
  createdAt,
  items,
}: {
  storeName: string;
  createdAt: string;
  items: ResponseItem[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className="border-t border-neutral-100">
        <td className="px-4 py-2 text-neutral-500">{createdAt}</td>
        <td className="px-4 py-2 font-medium text-neutral-900">{storeName}</td>
        <td className="px-4 py-2 text-neutral-500">
          {items.length} {items.length === 1 ? "produto" : "produtos"}
        </td>
        <td className="px-4 py-2 text-right">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:underline"
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {open ? "Ocultar detalhes" : "Ver detalhes"}
          </button>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={4} className="bg-neutral-50 px-4 py-3">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-neutral-500">
                <tr>
                  <th className="py-1 pr-4">Setor</th>
                  <th className="py-1 pr-4">Produto</th>
                  <th className="py-1 pr-4">Qtd. informada</th>
                  <th className="py-1 pr-4">Estoque mínimo</th>
                  <th className="py-1 pr-4">A produzir</th>
                  <th className="py-1 pr-4">Corrigir</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.reportId} className={cn("border-t border-neutral-200")}>
                    <td className="py-1.5 pr-4">{item.sectorName}</td>
                    <td className="py-1.5 pr-4">{item.productName}</td>
                    <td className="py-1.5 pr-4">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-1.5 pr-4 text-neutral-500">
                      {item.minQuantity === null ? "—" : `${item.minQuantity} ${item.unit}`}
                    </td>
                    <td className="py-1.5 pr-4">
                      {item.toProduce === null ? (
                        "—"
                      ) : item.toProduce > 0 ? (
                        <span className="font-semibold text-red-600">
                          {item.toProduce} {item.unit}
                        </span>
                      ) : (
                        <span className="text-green-700">0 {item.unit}</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-4">
                      <form action={correctStockReport} className="flex items-center gap-2">
                        <input type="hidden" name="store_id" value={item.storeId} />
                        <input type="hidden" name="product_id" value={item.productId} />
                        <Input
                          type="number"
                          step="0.001"
                          min={0}
                          name="quantity_reported"
                          defaultValue={item.quantity}
                          className="w-24"
                        />
                        <button
                          type="submit"
                          className="rounded-md bg-orange-600 px-2 py-1 text-xs text-white hover:bg-orange-700"
                        >
                          Salvar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
