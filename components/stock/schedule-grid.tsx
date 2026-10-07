"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Copy, Pencil, Plus, Printer, X } from "lucide-react";
import {
  addScheduleItem,
  copyPreviousScheduleWeek,
  moveScheduleItem,
  removeScheduleItem,
  renameScheduleItem,
  saveScheduleNotes,
  setScheduleCell,
  toggleScheduleHoliday,
  type ScheduleResult,
} from "@/app/(app)/estoque/cronograma/actions";
import {
  SCHEDULE_ACTIONS,
  SCHEDULE_SECTIONS,
  SCHEDULE_WEEKDAYS,
  labelTone,
  type LabelTone,
  type ScheduleSection,
} from "@/lib/schedule/week";
import { formatBrDate } from "@/lib/dates";

export type GridItem = { id: string; section: ScheduleSection; name: string };

type MenuState = { itemId: string; weekday: number; top: number; left: number };

const TONE: Record<LabelTone, string> = {
  produce: "bg-orange-100 text-orange-800 print:bg-orange-500 print:text-white",
  prep: "bg-amber-50 text-amber-800 print:bg-amber-200 print:text-amber-900",
  thaw: "bg-sky-100 text-sky-800 print:bg-sky-500 print:text-white",
  free: "bg-neutral-100 text-neutral-700 print:bg-neutral-200 print:text-neutral-800",
};

// on screen the block header is a soft tint; printed it is a solid band in the block's colour
const SECTION_STYLE: Record<ScheduleSection, { title: string; day: string }> = {
  salgados: { title: "bg-orange-50 print:bg-orange-600", day: "bg-orange-50 print:bg-orange-100" },
  folheados: { title: "bg-amber-50 print:bg-amber-500", day: "bg-amber-50 print:bg-amber-100" },
  paes: { title: "bg-stone-100 print:bg-stone-600", day: "bg-stone-100 print:bg-stone-200" },
  cozinha: { title: "bg-emerald-50 print:bg-emerald-700", day: "bg-emerald-50 print:bg-emerald-100" },
};

export function ScheduleGrid({
  weekStart,
  dates,
  items,
  initialCells,
  initialHolidays,
  initialNotes,
  canEdit,
}: {
  weekStart: string;
  dates: string[];
  items: GridItem[];
  initialCells: Record<string, string>;
  initialHolidays: number[];
  initialNotes: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [cells, setCells] = useState(initialCells);
  const [holidays, setHolidays] = useState(initialHolidays);
  const [notes, setNotes] = useState(initialNotes);
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [printedAt, setPrintedAt] = useState("");
  const [, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  // stamp the print with the moment it is printed, in Fortaleza time whatever the device says
  useEffect(() => {
    const stamp = () =>
      setPrintedAt(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short" }).format(new Date()));
    window.addEventListener("beforeprint", stamp);
    return () => window.removeEventListener("beforeprint", stamp);
  }, []);

  const hasCells = Object.keys(cells).length > 0;
  const bySection = useMemo(
    () => SCHEDULE_SECTIONS.map((s) => ({ ...s, items: items.filter((i) => i.section === s.key) })),
    [items]
  );

  function run(action: () => Promise<ScheduleResult>, onFail?: () => void, refresh = false) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        onFail?.();
      } else if (refresh) {
        router.refresh();
      }
    });
  }

  function applyLabel(itemId: string, weekday: number, label: string) {
    const key = `${itemId}:${weekday}`;
    const previous = cells[key];
    setCells((prev) => {
      const next = { ...prev };
      if (label) next[key] = label;
      else delete next[key];
      return next;
    });
    setMenu(null);
    setCustom("");
    run(
      () => setScheduleCell({ week_start: weekStart, item_id: itemId, weekday, label }),
      () =>
        setCells((prev) => {
          const next = { ...prev };
          if (previous) next[key] = previous;
          else delete next[key];
          return next;
        })
    );
  }

  function toggleHoliday(weekday: number) {
    const was = holidays.includes(weekday);
    setHolidays((prev) => (was ? prev.filter((d) => d !== weekday) : [...prev, weekday]));
    run(
      () => toggleScheduleHoliday({ week_start: weekStart, weekday }),
      () => setHolidays((prev) => (was ? [...prev, weekday] : prev.filter((d) => d !== weekday)))
    );
  }

  function openMenu(e: React.MouseEvent<HTMLButtonElement>, itemId: string, weekday: number) {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = 176;
    setCustom("");
    setMenu({
      itemId,
      weekday,
      top: Math.min(rect.bottom + 4, window.innerHeight - 380),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    });
  }

  return (
    <div className="space-y-4">
      <style>{"@media print { @page { size: A4 landscape; margin: 8mm; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }"}</style>

      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        {canEdit && !hasCells && (
          <button
            type="button"
            onClick={() => run(() => copyPreviousScheduleWeek({ week_start: weekStart }), undefined, true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar semana anterior
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
              editing ? "border-orange-600 bg-orange-50 text-orange-700" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            {editing ? "Concluir edição da lista" : "Editar lista de produtos"}
          </button>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
        >
          <Printer className="h-3.5 w-3.5" />
          Imprimir
        </button>
      </div>

      {error && <p className="text-sm text-red-600 print:hidden">{error}</p>}

      <div className="hidden items-end justify-between border-b-2 border-orange-600 pb-2 print:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-600 text-xs font-extrabold text-white">
            EP
          </span>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-orange-600">
              Empório do Pão · Fábrica Osório de Paiva
            </p>
            <p className="text-lg font-black leading-tight text-neutral-900">Cronograma semanal de produção</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-neutral-500">Semana</p>
          <p className="text-base font-extrabold leading-tight text-neutral-900">
            {formatBrDate(dates[0])} a {formatBrDate(dates[4])}
          </p>
        </div>
      </div>

      {bySection.map((section) => {
        const style = SECTION_STYLE[section.key];
        return (
          <section
            key={section.key}
            className="overflow-x-auto rounded-lg border border-neutral-200 bg-white print:overflow-visible print:rounded-md print:border-neutral-300"
          >
            <table className="w-full min-w-[640px] border-collapse text-left text-sm print:min-w-0 print:text-[10px]">
              <thead>
                <tr>
                  <th className={`px-3 py-2 text-xs font-bold uppercase tracking-wide text-neutral-900 print:py-1.5 print:text-[10px] print:tracking-widest print:text-white ${style.title}`}>
                    {section.label}
                  </th>
                  {SCHEDULE_WEEKDAYS.map((d, i) => (
                    <th key={d.n} className={`w-[14%] px-2 py-1.5 text-center print:py-1 ${style.day}`}>
                      <div className="text-[11px] font-bold uppercase text-neutral-800 print:text-[9px]">{d.label}</div>
                      <div className="text-[10px] font-normal text-neutral-500 print:text-[8px] print:text-neutral-600">{formatBrDate(dates[i])}</div>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => toggleHoliday(d.n)}
                          className="mt-0.5 text-[10px] font-medium text-neutral-400 hover:text-orange-700 print:hidden"
                        >
                          {holidays.includes(d.n) ? "desmarcar feriado" : "feriado"}
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.items.map((item, index) => (
                  <tr key={item.id} className="break-inside-avoid border-t border-neutral-100 print:border-neutral-200 print:even:bg-neutral-50">
                    <td className="px-3 py-1 text-neutral-900 print:py-px">
                      {editing ? (
                        <EditableName
                          item={item}
                          isFirst={index === 0}
                          isLast={index === section.items.length - 1}
                          run={run}
                        />
                      ) : (
                        <span className="text-[13px] font-medium print:text-[9.5px] print:font-semibold">{item.name}</span>
                      )}
                    </td>
                    {SCHEDULE_WEEKDAYS.map((d) => {
                      const label = cells[`${item.id}:${d.n}`];
                      const isHoliday = holidays.includes(d.n);
                      return (
                        <td
                          key={d.n}
                          className={`border-l border-neutral-100 px-1 py-0.5 text-center print:border-neutral-200 print:px-0.5 print:py-px ${isHoliday ? "bg-neutral-100 print:bg-neutral-200" : ""}`}
                        >
                          {isHoliday ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 print:text-[8px] print:text-neutral-500">feriado</span>
                          ) : (
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={(e) => openMenu(e, item.id, d.n)}
                              className={`min-h-6 w-full rounded px-1 py-0.5 text-[11px] font-semibold uppercase print:min-h-0 print:text-[8.5px] print:leading-tight ${
                                label ? TONE[labelTone(label)] : canEdit ? "text-transparent hover:bg-neutral-100 hover:text-neutral-300 print:hover:bg-transparent print:hover:text-transparent" : "text-transparent"
                              }`}
                            >
                              {label ?? "+"}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {editing && (
                  <tr className="border-t border-neutral-100 print:hidden">
                    <td colSpan={6} className="px-3 py-1.5">
                      <AddItemForm section={section.key} run={run} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        );
      })}

      <section className="rounded-lg border border-neutral-200 bg-white p-3 print:break-inside-avoid print:rounded-md print:border-neutral-300 print:bg-neutral-50">
        <label htmlFor="schedule-notes" className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 print:text-[9px] print:text-orange-700">
          Observações
        </label>
        {canEdit ? (
          <textarea
            id="schedule-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => run(() => saveScheduleNotes({ week_start: weekStart, notes }))}
            rows={3}
            className="mt-1 w-full resize-y rounded-md border border-neutral-200 px-2 py-1.5 text-base text-neutral-800 focus:border-orange-500 focus:outline-none sm:text-sm print:resize-none print:border-0 print:bg-transparent print:p-0 print:text-[10px]"
          />
        ) : (
          <p className="mt-1 whitespace-pre-line text-sm text-neutral-800 print:text-[10px]">{notes || "—"}</p>
        )}
      </section>

      <div className="hidden items-center justify-between gap-4 text-[9px] text-neutral-500 print:flex">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold uppercase tracking-wide">Legenda</span>
          <span className="rounded bg-orange-500 px-1.5 py-0.5 font-semibold uppercase text-white">Produzir</span>
          <span className="rounded bg-orange-600 px-1.5 py-0.5 font-semibold uppercase text-white">2x Produzir</span>
          <span className="rounded bg-amber-200 px-1.5 py-0.5 font-semibold uppercase text-amber-900">Preparos</span>
          <span className="rounded bg-sky-500 px-1.5 py-0.5 font-semibold uppercase text-white">Descongelar</span>
          <span className="rounded bg-neutral-200 px-1.5 py-0.5 font-semibold uppercase text-neutral-700">Outro</span>
          <span className="rounded bg-neutral-300 px-1.5 py-0.5 font-semibold uppercase text-neutral-600">Feriado</span>
        </div>
        <span>Impresso em {printedAt}</span>
      </div>

      {menu && (
        <div
          ref={menuRef}
          style={{ top: menu.top, left: menu.left }}
          className="fixed z-50 w-44 rounded-lg border border-neutral-200 bg-white py-1 shadow-xl print:hidden"
        >
          {SCHEDULE_ACTIONS.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => applyLabel(menu.itemId, menu.weekday, action)}
              className="block w-full px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50"
            >
              {action}
            </button>
          ))}
          <form
            className="flex gap-1 border-t border-neutral-100 px-2 pt-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (custom.trim()) applyLabel(menu.itemId, menu.weekday, custom.trim());
            }}
          >
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              maxLength={60}
              placeholder="Outro texto"
              className="min-w-0 flex-1 rounded border border-neutral-300 px-1.5 py-1 text-base sm:text-xs"
            />
            <button type="submit" className="rounded bg-orange-600 px-2 text-xs font-semibold text-white">
              OK
            </button>
          </form>
          {cells[`${menu.itemId}:${menu.weekday}`] && (
            <button
              type="button"
              onClick={() => applyLabel(menu.itemId, menu.weekday, "")}
              className="mt-1 block w-full border-t border-neutral-100 px-3 py-1.5 text-left text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Limpar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type Runner = (action: () => Promise<ScheduleResult>, onFail?: () => void, refresh?: boolean) => void;

function EditableName({
  item,
  isFirst,
  isLast,
  run,
}: {
  item: GridItem;
  isFirst: boolean;
  isLast: boolean;
  run: Runner;
}) {
  const [name, setName] = useState(item.name);
  return (
    <div className="flex items-center gap-1">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() !== item.name && run(() => renameScheduleItem({ id: item.id, name }), () => setName(item.name), true)}
        className="min-w-0 flex-1 rounded border border-neutral-200 px-1.5 py-0.5 text-base sm:text-[13px]"
      />
      <button
        type="button"
        disabled={isFirst}
        onClick={() => run(() => moveScheduleItem({ id: item.id, direction: "up" }), undefined, true)}
        className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"
        aria-label="Subir"
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        disabled={isLast}
        onClick={() => run(() => moveScheduleItem({ id: item.id, direction: "down" }), undefined, true)}
        className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"
        aria-label="Descer"
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => confirm(`Tirar "${item.name}" do cronograma?`) && run(() => removeScheduleItem({ id: item.id }), undefined, true)}
        className="rounded p-0.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
        aria-label="Remover"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function AddItemForm({ section, run }: { section: ScheduleSection; run: Runner }) {
  const [name, setName] = useState("");
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        run(() => addScheduleItem({ section, name }), undefined, true);
        setName("");
      }}
    >
      <Plus className="h-3.5 w-3.5 text-neutral-400" />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Adicionar produto"
        className="min-w-0 flex-1 rounded border border-neutral-200 px-1.5 py-1 text-base sm:text-xs"
      />
      <button type="submit" className="rounded bg-orange-600 px-2.5 py-1 text-xs font-semibold text-white">
        Adicionar
      </button>
    </form>
  );
}
