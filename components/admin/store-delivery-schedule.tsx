"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { saveStoreDeliverySchedule } from "@/app/(app)/admin/lojas/actions";
import { WEEKDAY_ORDER, WEEKDAY_LABELS } from "@/lib/format/labels";
import { productionWeekdayForDelivery, sendWeekdayForDelivery, SEND_DEADLINE_TIME } from "@/lib/delivery-schedule";
import type { StoreDeliveryDay, Weekday } from "@/lib/types/database.types";

export function StoreDeliverySchedule({
  storeId,
  routeName,
  initialEntries,
}: {
  storeId: string;
  routeName: string;
  initialEntries: StoreDeliveryDay[];
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState<Set<Weekday>>(() => new Set(initialEntries.map((e) => e.weekday)));
  const [saving, setSaving] = useState(false);

  function toggleDay(weekday: Weekday) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(weekday)) next.delete(weekday);
      else next.add(weekday);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    const formData = new FormData();
    formData.set("store_id", storeId);
    formData.set("weekdays", JSON.stringify(WEEKDAY_ORDER.filter((w) => enabled.has(w))));
    await saveStoreDeliverySchedule(formData);
    setSaving(false);
    router.refresh();
  }

  const activeWeekdays = WEEKDAY_ORDER.filter((w) => enabled.has(w));

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        Rota: <span className="font-medium text-neutral-900">{routeName}</span>
      </p>

      <div className="flex flex-wrap gap-2">
        {WEEKDAY_ORDER.map((weekday) => (
          <label
            key={weekday}
            className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-900"
          >
            <input
              type="checkbox"
              checked={enabled.has(weekday)}
              onChange={() => toggleDay(weekday)}
              className="h-4 w-4 rounded border-neutral-300 text-orange-600 focus:ring-orange-600"
            />
            {WEEKDAY_LABELS[weekday]}
          </label>
        ))}
      </div>

      {activeWeekdays.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-neutral-900">Prazos (calculados automaticamente)</h3>
          <table className="w-full max-w-lg border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                <th className="border border-neutral-200 px-2 py-1">Entrega</th>
                <th className="border border-neutral-200 px-2 py-1">Enviar pedido até</th>
                <th className="border border-neutral-200 px-2 py-1">Produção</th>
              </tr>
            </thead>
            <tbody>
              {activeWeekdays.map((w) => (
                <tr key={w}>
                  <td className="border border-neutral-200 px-2 py-1 font-medium text-neutral-900">
                    {WEEKDAY_LABELS[w]}
                  </td>
                  <td className="border border-neutral-200 px-2 py-1">
                    {WEEKDAY_LABELS[sendWeekdayForDelivery(w)]}, {SEND_DEADLINE_TIME}
                  </td>
                  <td className="border border-neutral-200 px-2 py-1">{WEEKDAY_LABELS[productionWeekdayForDelivery(w)]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Button type="button" onClick={handleSave} disabled={saving}>
        {saving ? "Salvando..." : "Salvar dias de entrega"}
      </Button>
    </div>
  );
}
