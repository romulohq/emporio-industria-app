"use client";

import { useMemo, useState } from "react";
import { ArrowUp, ArrowDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { WEEKDAY_ORDER, WEEKDAY_LABELS, PERIOD_LABELS, PERIOD_ORDER } from "@/lib/format/labels";
import type { DeliveryPeriod, Weekday } from "@/lib/types/database.types";
import type { ScheduleEntry } from "@/lib/validations/delivery-schedule";

type StoreOption = { id: string; name: string };
type DaySchedule = Record<DeliveryPeriod, string[]>;
type WeekSchedule = Record<Weekday, DaySchedule>;

function emptyWeek(): WeekSchedule {
  const week = {} as WeekSchedule;
  for (const day of WEEKDAY_ORDER) week[day] = { morning: [], afternoon: [] };
  return week;
}

export function WeeklyScheduleEditor({
  unitId,
  stores,
  initialEntries,
  saveAction,
}: {
  unitId: string;
  stores: StoreOption[];
  initialEntries: ScheduleEntry[];
  saveAction: (formData: FormData) => void | Promise<void>;
}) {
  const [week, setWeek] = useState<WeekSchedule>(() => {
    const w = emptyWeek();
    const byDay = new Map<string, ScheduleEntry[]>();
    for (const entry of initialEntries) {
      const key = `${entry.weekday}:${entry.period}`;
      const list = byDay.get(key) ?? [];
      list.push(entry);
      byDay.set(key, list);
    }
    for (const day of WEEKDAY_ORDER) {
      for (const period of PERIOD_ORDER) {
        const list = (byDay.get(`${day}:${period}`) ?? []).sort((a, b) => a.position - b.position);
        w[day][period] = list.map((e) => e.store_id);
      }
    }
    return w;
  });

  const storeName = useMemo(() => {
    const map = new Map(stores.map((s) => [s.id, s.name]));
    return (id: string) => map.get(id) ?? "?";
  }, [stores]);

  function moveUp(day: Weekday, period: DeliveryPeriod, index: number) {
    setWeek((prev) => {
      const next = { ...prev, [day]: { morning: [...prev[day].morning], afternoon: [...prev[day].afternoon] } };
      if (index > 0) {
        const arr = next[day][period];
        [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
      } else if (period === "afternoon") {
        const [item] = next[day].afternoon.splice(0, 1);
        next[day].morning.push(item);
      }
      return next;
    });
  }

  function moveDown(day: Weekday, period: DeliveryPeriod, index: number) {
    setWeek((prev) => {
      const next = { ...prev, [day]: { morning: [...prev[day].morning], afternoon: [...prev[day].afternoon] } };
      const arr = next[day][period];
      if (index < arr.length - 1) {
        [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
      } else if (period === "morning") {
        const [item] = next[day].morning.splice(index, 1);
        next[day].afternoon.unshift(item);
      }
      return next;
    });
  }

  function removeFromDay(day: Weekday, period: DeliveryPeriod, index: number) {
    setWeek((prev) => {
      const arr = [...prev[day][period]];
      arr.splice(index, 1);
      return { ...prev, [day]: { ...prev[day], [period]: arr } };
    });
  }

  function addToDay(day: Weekday, storeId: string) {
    if (!storeId) return;
    setWeek((prev) => ({
      ...prev,
      [day]: { ...prev[day], morning: [...prev[day].morning, storeId] },
    }));
  }

  const scheduleJson = useMemo(() => {
    const entries: ScheduleEntry[] = [];
    for (const day of WEEKDAY_ORDER) {
      for (const period of PERIOD_ORDER) {
        week[day][period].forEach((storeId, position) => {
          entries.push({ store_id: storeId, weekday: day, period, position });
        });
      }
    }
    return JSON.stringify(entries);
  }, [week]);

  return (
    <form action={saveAction} className="space-y-4">
      <input type="hidden" name="unit_id" value={unitId} />
      <input type="hidden" name="schedule" value={scheduleJson} />

      <div className="grid gap-3 overflow-x-auto pb-2 sm:grid-cols-7">
        {WEEKDAY_ORDER.map((day) => {
          const assignedIds = new Set([...week[day].morning, ...week[day].afternoon]);
          const available = stores.filter((s) => !assignedIds.has(s.id));

          return (
            <div key={day} className="min-w-[170px] rounded-lg border border-neutral-200 bg-white">
              <div className="border-b border-neutral-100 bg-neutral-50 px-3 py-2 text-center text-xs font-semibold uppercase text-neutral-600">
                {WEEKDAY_LABELS[day]}
              </div>

              {PERIOD_ORDER.map((period) => (
                <div key={period}>
                  <div className="border-b border-neutral-100 bg-neutral-50/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                    {PERIOD_LABELS[period]}
                  </div>
                  <ul className="divide-y divide-neutral-100">
                    {week[day][period].map((storeId, index) => (
                      <li
                        key={storeId}
                        className="flex items-center justify-between gap-1 px-2 py-1.5 text-xs text-neutral-800"
                      >
                        <span className="truncate">{storeName(storeId)}</span>
                        <span className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveUp(day, period, index)}
                            className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                            aria-label="Mover para cima"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveDown(day, period, index)}
                            className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                            aria-label="Mover para baixo"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromDay(day, period, index)}
                            className="rounded p-0.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                            aria-label="Remover deste dia"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </li>
                    ))}
                    {week[day][period].length === 0 && (
                      <li className="px-2 py-1.5 text-center text-xs text-neutral-400">—</li>
                    )}
                  </ul>
                </div>
              ))}

              <div className="p-2">
                <Select
                  value=""
                  onChange={(e) => {
                    addToDay(day, e.target.value);
                    e.target.value = "";
                  }}
                  className="text-xs"
                >
                  <option value="">+ adicionar loja</option>
                  {available.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          );
        })}
      </div>

      <Button type="submit">Salvar dias de entrega</Button>
    </form>
  );
}
