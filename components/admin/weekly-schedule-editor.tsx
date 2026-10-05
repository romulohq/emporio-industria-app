"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, MoreVertical, Printer, X } from "lucide-react";
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

function buildWeek(entries: ScheduleEntry[]): WeekSchedule {
  const w = emptyWeek();
  const byDay = new Map<string, ScheduleEntry[]>();
  for (const entry of entries) {
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
  const router = useRouter();
  const [week, setWeek] = useState<WeekSchedule>(() => buildWeek(initialEntries));
  const [initialWeekJson] = useState(() => JSON.stringify(buildWeek(initialEntries)));

  const storeName = useMemo(() => {
    const map = new Map(stores.map((s) => [s.id, s.name]));
    return (id: string) => map.get(id) ?? "?";
  }, [stores]);

  const [openRow, setOpenRow] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openRow) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenRow(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [openRow]);

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

  const isDirty = useMemo(() => JSON.stringify(week) !== initialWeekJson, [week, initialWeekJson]);

  // warn on browser-level navigation (tab close, refresh, typed URL)
  useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // warn on in-app navigation (sidebar links, unit pills, etc.)
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isDirty) return;
    function onClickCapture(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank") return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(url.pathname + url.search);
    }
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [isDirty]);

  async function handleSaveAndLeave() {
    setSaving(true);
    const fd = new FormData();
    fd.set("unit_id", unitId);
    fd.set("schedule", scheduleJson);
    await saveAction(fd);
    setSaving(false);
    if (pendingHref) router.push(pendingHref);
    setPendingHref(null);
  }

  function handleLeaveWithoutSaving() {
    if (pendingHref) router.push(pendingHref);
    setPendingHref(null);
  }

  return (
    <>
      {/* the delivery grid is the one print that needs landscape; everything else stays portrait */}
      <style>{"@media print { @page { size: A4 landscape; margin: 10mm; } }"}</style>
      <form action={saveAction} className="space-y-4">
        <input type="hidden" name="unit_id" value={unitId} />
        <input type="hidden" name="schedule" value={scheduleJson} />

        <div className="flex justify-end print:hidden">
          <Button
            type="button"
            variant="secondary"
            onClick={() => window.print()}
            className="gap-1.5"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </div>

        <div className="grid gap-2 overflow-x-auto pb-2 sm:grid-cols-7 print:grid-cols-7 print:gap-1 print:overflow-visible">
          {WEEKDAY_ORDER.map((day) => {
            const assignedIds = new Set([...week[day].morning, ...week[day].afternoon]);
            const available = stores.filter((s) => !assignedIds.has(s.id));

            return (
              <div key={day} className="min-w-[150px] rounded-lg border border-neutral-200 bg-white print:break-inside-avoid">
                <div className="border-b border-neutral-100 bg-neutral-50 px-3 py-2 text-center text-xs font-semibold uppercase text-neutral-600">
                  {WEEKDAY_LABELS[day]}
                </div>

                {PERIOD_ORDER.map((period) => (
                  <div key={period}>
                    <div className="border-b border-neutral-100 bg-neutral-50/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                      {PERIOD_LABELS[period]}
                    </div>
                    <ul className="divide-y divide-neutral-100">
                      {week[day][period].map((storeId, index) => {
                        const rowKey = `${day}:${period}:${storeId}`;
                        const isOpen = openRow === rowKey;
                        return (
                          <li key={storeId} className="relative flex items-center justify-between gap-1 px-2 py-1.5 text-xs text-neutral-800">
                            <span className="truncate">{storeName(storeId)}</span>
                            <button
                              type="button"
                              onClick={() => setOpenRow(isOpen ? null : rowKey)}
                              className="shrink-0 rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 print:hidden"
                              aria-label="Opções da loja"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>

                            {isOpen && (
                              <div
                                ref={menuRef}
                                className="absolute right-1 top-full z-10 mt-0.5 w-40 rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    moveUp(day, period, index);
                                    setOpenRow(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50"
                                >
                                  <ArrowUp className="h-3.5 w-3.5" /> Mover para cima
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    moveDown(day, period, index);
                                    setOpenRow(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50"
                                >
                                  <ArrowDown className="h-3.5 w-3.5" /> Mover para baixo
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    removeFromDay(day, period, index);
                                    setOpenRow(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
                                >
                                  <X className="h-3.5 w-3.5" /> Remover
                                </button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                      {week[day][period].length === 0 && (
                        <li className="px-2 py-1.5 text-center text-xs text-neutral-400">—</li>
                      )}
                    </ul>
                  </div>
                ))}

                <div className="p-2 print:hidden">
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

        <Button type="submit" className="print:hidden">
          Salvar dias de entrega
        </Button>
      </form>

      {pendingHref && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-neutral-900">Deseja salvar as alterações?</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Você fez alterações nos dias de entrega que ainda não foram salvas.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setPendingHref(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="button" variant="secondary" onClick={handleLeaveWithoutSaving} disabled={saving}>
                Sair sem salvar
              </Button>
              <Button type="button" onClick={handleSaveAndLeave} disabled={saving}>
                {saving ? "Salvando…" : "Salvar e sair"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
