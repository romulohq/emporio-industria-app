"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { saveStoreDeliverySchedule } from "@/app/(app)/admin/lojas/actions";
import { WEEKDAY_ORDER, WEEKDAY_LABELS } from "@/lib/format/labels";
import { defaultSendWeekday, DEFAULT_DEADLINE_TIME } from "@/lib/delivery-schedule";
import type { StoreDeliveryDay, Weekday } from "@/lib/types/database.types";

type RowState = {
  enabled: boolean;
  sendWeekday: Weekday;
  deadlineTime: string;
  isCustom: boolean;
};

function buildInitialState(entries: StoreDeliveryDay[]): Record<Weekday, RowState> {
  const byWeekday = Object.fromEntries(entries.map((e) => [e.weekday, e])) as Partial<
    Record<Weekday, StoreDeliveryDay>
  >;
  const state = {} as Record<Weekday, RowState>;
  for (const weekday of WEEKDAY_ORDER) {
    const existing = byWeekday[weekday];
    state[weekday] = existing
      ? {
          enabled: true,
          sendWeekday: existing.send_weekday,
          deadlineTime: existing.deadline_time.slice(0, 5),
          isCustom: existing.is_custom,
        }
      : {
          enabled: false,
          sendWeekday: defaultSendWeekday(weekday),
          deadlineTime: DEFAULT_DEADLINE_TIME,
          isCustom: false,
        };
  }
  return state;
}

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
  const [rows, setRows] = useState<Record<Weekday, RowState>>(() => buildInitialState(initialEntries));
  const [saving, setSaving] = useState(false);

  function toggleDay(weekday: Weekday) {
    setRows((prev) => ({ ...prev, [weekday]: { ...prev[weekday], enabled: !prev[weekday].enabled } }));
  }

  function updateRow(weekday: Weekday, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [weekday]: { ...prev[weekday], ...patch, isCustom: true } }));
  }

  function resetToDefault(weekday: Weekday) {
    setRows((prev) => ({
      ...prev,
      [weekday]: {
        ...prev[weekday],
        sendWeekday: defaultSendWeekday(weekday),
        deadlineTime: DEFAULT_DEADLINE_TIME,
        isCustom: false,
      },
    }));
  }

  async function handleSave() {
    setSaving(true);
    const formData = new FormData();
    formData.set("store_id", storeId);
    const entries = WEEKDAY_ORDER.filter((w) => rows[w].enabled).map((w) => ({
      weekday: w,
      send_weekday: rows[w].sendWeekday,
      deadline_time: rows[w].deadlineTime,
      is_custom: rows[w].isCustom,
    }));
    formData.set("entries", JSON.stringify(entries));
    await saveStoreDeliverySchedule(formData);
    setSaving(false);
    router.refresh();
  }

  const activeWeekdays = WEEKDAY_ORDER.filter((w) => rows[w].enabled);

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        Rota: <span className="font-medium text-neutral-900">{routeName}</span>
      </p>

      <div className="space-y-2">
        {WEEKDAY_ORDER.map((weekday) => {
          const row = rows[weekday];
          return (
            <div key={weekday} className="rounded-lg border border-neutral-200 bg-white p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={() => toggleDay(weekday)}
                  className="h-4 w-4 rounded border-neutral-300 text-orange-600 focus:ring-orange-600"
                />
                Entrega {WEEKDAY_LABELS[weekday]}
              </label>

              {row.enabled && (
                <div className="mt-2 flex flex-wrap items-center gap-3 pl-6">
                  <div>
                    <label className="mb-1 block text-xs text-neutral-500">Enviar pedido</label>
                    <Select
                      value={row.sendWeekday}
                      onChange={(e) => updateRow(weekday, { sendWeekday: e.target.value as Weekday })}
                      className="w-36"
                    >
                      {WEEKDAY_ORDER.map((w) => (
                        <option key={w} value={w}>
                          {WEEKDAY_LABELS[w]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-neutral-500">Até</label>
                    <Input
                      type="time"
                      value={row.deadlineTime}
                      onChange={(e) => updateRow(weekday, { deadlineTime: e.target.value })}
                      className="w-28"
                    />
                  </div>
                  {row.isCustom && <Badge tone="amber">Personalizado</Badge>}
                  {row.isCustom && (
                    <button
                      type="button"
                      onClick={() => resetToDefault(weekday)}
                      className="text-xs font-medium text-orange-700 hover:underline"
                    >
                      Voltar ao padrão (48h)
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {activeWeekdays.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-neutral-900">Agenda</h3>
          <table className="w-full max-w-md border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                <th className="border border-neutral-200 px-2 py-1">Entrega</th>
                <th className="border border-neutral-200 px-2 py-1">Enviar pedido</th>
                <th className="border border-neutral-200 px-2 py-1">Até</th>
              </tr>
            </thead>
            <tbody>
              {activeWeekdays.map((w) => (
                <tr key={w}>
                  <td className="border border-neutral-200 px-2 py-1 font-medium text-neutral-900">
                    {WEEKDAY_LABELS[w]}
                  </td>
                  <td className="border border-neutral-200 px-2 py-1">{WEEKDAY_LABELS[rows[w].sendWeekday]}</td>
                  <td className="border border-neutral-200 px-2 py-1">{rows[w].deadlineTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Button type="button" onClick={handleSave} disabled={saving}>
        {saving ? "Salvando..." : "Salvar dias de entrega e prazos"}
      </Button>
    </div>
  );
}
