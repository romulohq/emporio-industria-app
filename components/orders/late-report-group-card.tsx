"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { keepCurrentOrder } from "@/app/(app)/pedidos/dia/actions";
import { formatDateTime, formatQuantity } from "@/lib/format/labels";

export type LateReportItem = {
  reportId: string;
  storeName: string;
  productName: string;
  unit: string;
  quantityReported: number;
  createdAt: string;
  minutesLate: number;
};

export function LateReportGroupCard({
  sectorId,
  sectorName,
  deliveryDate,
  deliveryLabel,
  items,
}: {
  sectorId: string;
  sectorName: string;
  deliveryDate: string;
  deliveryLabel: string;
  items: LateReportItem[];
}) {
  const router = useRouter();
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [keeping, setKeeping] = useState(false);

  function toggle(reportId: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(reportId)) next.delete(reportId);
      else next.add(reportId);
      return next;
    });
  }

  async function handleKeep() {
    setKeeping(true);
    const formData = new FormData();
    formData.set("sector_id", sectorId);
    formData.set("delivery_date", deliveryDate);
    for (const item of items) formData.append("report_ids", item.reportId);
    await keepCurrentOrder(formData);
    setKeeping(false);
    router.refresh();
  }

  const includedCount = items.length - excluded.size;
  const excludeParam = [...excluded].join(",");

  return (
    <div className="rounded-lg border border-orange-300 bg-orange-50 p-4">
      <p className="text-sm font-semibold text-orange-900">
        {sectorName} — {deliveryLabel}: {items.length === 1 ? "1 pedido atrasado" : `${items.length} pedidos atrasados`}
      </p>
      <p className="mt-0.5 text-xs text-orange-700">
        Chegaram depois que essa ordem já foi gerada. Escolha o que incluir e gere novamente, ou mantenha a ordem
        atual.
      </p>

      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <label
            key={item.reportId}
            className="flex flex-wrap items-center gap-2 rounded-md bg-white px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              checked={!excluded.has(item.reportId)}
              onChange={() => toggle(item.reportId)}
              className="h-4 w-4 rounded border-neutral-300 text-orange-600 focus:ring-orange-600"
            />
            <span className="text-neutral-700">
              <span className="font-medium text-neutral-900">{item.storeName}</span> — {item.productName}:{" "}
              {formatQuantity(item.quantityReported, item.unit)} relatado em {formatDateTime(item.createdAt)} (
              {item.minutesLate >= 60
                ? `${Math.floor(item.minutesLate / 60)}h${item.minutesLate % 60 ? ` ${item.minutesLate % 60}min` : ""}`
                : `${item.minutesLate}min`}{" "}
              de atraso)
            </span>
          </label>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={`/pedidos/dia/revisar-atraso?sector=${sectorId}&date=${deliveryDate}${excludeParam ? `&excluir=${excludeParam}` : ""}`}
          className={`rounded-md px-3 py-1.5 text-xs font-medium text-white ${
            includedCount > 0 ? "bg-orange-600 hover:bg-orange-700" : "pointer-events-none bg-neutral-300"
          }`}
        >
          Gerar novamente {includedCount > 0 ? `(${includedCount})` : ""}
        </a>
        <button
          type="button"
          onClick={handleKeep}
          disabled={keeping}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
        >
          {keeping ? "Salvando..." : "Manter ordem atual"}
        </button>
      </div>
    </div>
  );
}
