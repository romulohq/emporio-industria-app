"use client";

import { useState } from "react";
import { LateStoreCard } from "@/components/orders/late-store-card";
import { weekdayOfISODate, formatBrDate } from "@/lib/dates";
import { WEEKDAY_LABELS } from "@/lib/format/labels";
import type { LateStoreGroup } from "@/lib/orders/group-late-by-store";

export function LateReportsPopup({ stores }: { stores: LateStoreGroup[] }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || stores.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-neutral-900">Pedidos atrasados</h3>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <div className="space-y-2">
          {stores.map((store) => (
            <LateStoreCard
              key={`${store.storeId}:${store.deliveryDate}`}
              storeId={store.storeId}
              storeName={store.storeName}
              deliveryDate={store.deliveryDate}
              deliveryLabel={`${WEEKDAY_LABELS[weekdayOfISODate(store.deliveryDate)]}, ${formatBrDate(store.deliveryDate)}`}
              sentAt={store.sentAt}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
