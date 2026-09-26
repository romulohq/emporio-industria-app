"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WEEKDAY_ORDER, WEEKDAY_LABELS, WEEKDAY_SHORT_LABELS } from "@/lib/format/labels";
import type { Weekday } from "@/lib/types/database.types";

type StoreOption = { id: string; name: string };

export function DeliveryDaysEditor({
  routeId,
  stores,
  initialSchedule,
  saveAction,
}: {
  routeId: string;
  stores: StoreOption[];
  initialSchedule: Record<string, Weekday[]>;
  saveAction: (formData: FormData) => void | Promise<void>;
}) {
  const [schedule, setSchedule] = useState<Record<string, Set<Weekday>>>(() => {
    const map: Record<string, Set<Weekday>> = {};
    for (const store of stores) {
      map[store.id] = new Set(initialSchedule[store.id] ?? []);
    }
    return map;
  });

  function toggle(storeId: string, day: Weekday) {
    setSchedule((prev) => {
      const next = { ...prev };
      const days = new Set(prev[storeId]);
      if (days.has(day)) days.delete(day);
      else days.add(day);
      next[storeId] = days;
      return next;
    });
  }

  const storesByName = (id: string) => stores.find((s) => s.id === id)?.name ?? "";

  return (
    <form action={saveAction} className="space-y-6">
      <input type="hidden" name="route_id" value={routeId} />
      {stores.map((store) => (
        <input key={store.id} type="hidden" name="store_id" value={store.id} />
      ))}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-neutral-900">Resumo da semana</h2>
        <div className="grid gap-2 overflow-x-auto sm:grid-cols-7">
          {WEEKDAY_ORDER.map((day) => {
            const storeIdsForDay = Object.entries(schedule)
              .filter(([, days]) => days.has(day))
              .map(([storeId]) => storeId)
              .sort((a, b) => storesByName(a).localeCompare(storesByName(b)));

            return (
              <div key={day} className="min-w-[140px] rounded-lg border border-neutral-200 bg-white">
                <div className="border-b border-neutral-100 bg-neutral-50 px-3 py-2 text-center text-xs font-semibold uppercase text-neutral-600">
                  {WEEKDAY_LABELS[day]}
                  <span className="ml-1 font-normal normal-case text-neutral-400">
                    ({storeIdsForDay.length})
                  </span>
                </div>
                <ul className="min-h-[40px] space-y-1 p-2">
                  {storeIdsForDay.length === 0 ? (
                    <li className="text-center text-xs text-neutral-400">—</li>
                  ) : (
                    storeIdsForDay.map((storeId) => (
                      <li
                        key={storeId}
                        className="rounded bg-orange-50 px-2 py-1 text-xs text-orange-800"
                      >
                        {storesByName(storeId)}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-neutral-900">Marcar dias por loja</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-2">Loja</th>
                {WEEKDAY_ORDER.map((day) => (
                  <th key={day} className="px-2 py-2 text-center">
                    {WEEKDAY_SHORT_LABELS[day]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => {
                const active = schedule[store.id] ?? new Set<Weekday>();
                return (
                  <tr key={store.id} className="border-t border-neutral-100">
                    <td className="px-4 py-2 font-medium text-neutral-900">{store.name}</td>
                    {WEEKDAY_ORDER.map((day) => (
                      <td key={day} className="px-2 py-2 text-center">
                        <label className="inline-flex cursor-pointer items-center justify-center">
                          <input
                            type="checkbox"
                            name={`day_${store.id}_${day}`}
                            checked={active.has(day)}
                            onChange={() => toggle(store.id, day)}
                            className="peer sr-only"
                          />
                          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white text-xs font-medium text-neutral-400 transition-colors peer-checked:border-orange-600 peer-checked:bg-orange-600 peer-checked:text-white">
                            {WEEKDAY_SHORT_LABELS[day].slice(0, 1)}
                          </span>
                        </label>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Button type="submit">Salvar dias de entrega</Button>
    </form>
  );
}
