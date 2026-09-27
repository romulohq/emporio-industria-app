"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical, RotateCcw } from "lucide-react";
import { setManualContribution, clearManualContribution } from "@/app/(app)/pedidos/dia/actions";
import { formatDateTime, formatQuantity } from "@/lib/format/labels";

export type ContributionHistoryItem = {
  reportId: string;
  createdAt: string;
  quantityReported: number;
};

export function ContributionMenu({
  orderId,
  storeId,
  locked,
  currentReportId,
  history,
  unit,
}: {
  orderId: string;
  storeId: string;
  locked: boolean;
  currentReportId: string | null;
  history: ContributionHistoryItem[];
  unit: string;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="shrink-0 rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        aria-label="Editar pedido desta loja"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-neutral-200 bg-white py-1 text-left shadow-lg"
        >
          <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            Usar outro envio
          </p>

          {locked && (
            <form action={clearManualContribution}>
              <input type="hidden" name="order_id" value={orderId} />
              <input type="hidden" name="store_id" value={storeId} />
              <button
                type="submit"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-orange-700 hover:bg-orange-50"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Voltar para automático
              </button>
            </form>
          )}

          <div className="max-h-56 overflow-y-auto">
            {history.length === 0 && (
              <p className="px-3 py-2 text-xs text-neutral-400">Nenhum envio anterior.</p>
            )}
            {history.map((item) => (
              <form key={item.reportId} action={setManualContribution}>
                <input type="hidden" name="order_id" value={orderId} />
                <input type="hidden" name="store_id" value={storeId} />
                <input type="hidden" name="report_id" value={item.reportId} />
                <button
                  type="submit"
                  disabled={item.reportId === currentReportId}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50 disabled:cursor-default disabled:font-semibold disabled:text-orange-700"
                >
                  <span>{formatDateTime(item.createdAt)}</span>
                  <span>{formatQuantity(item.quantityReported, unit)}</span>
                </button>
              </form>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
