"use client";

import { useState } from "react";
import { LateReportGroupCard } from "@/components/orders/late-report-group-card";
import { weekdayOfISODate, formatBrDate } from "@/lib/dates";
import { WEEKDAY_LABELS } from "@/lib/format/labels";
import type { LateReportGroup } from "@/lib/orders/late-reports";

export function LateReportsPopup({ groups }: { groups: LateReportGroup[] }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || groups.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-4 shadow-xl">
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
        <div className="space-y-3">
          {groups.map((group) => (
            <LateReportGroupCard
              key={`${group.sectorId}:${group.deliveryDate}`}
              sectorId={group.sectorId}
              sectorName={group.sectorName}
              deliveryDate={group.deliveryDate}
              deliveryLabel={`${WEEKDAY_LABELS[weekdayOfISODate(group.deliveryDate)]}, ${formatBrDate(group.deliveryDate)}`}
              items={group.items}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
