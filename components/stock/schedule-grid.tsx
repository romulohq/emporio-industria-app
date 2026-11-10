"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, ChevronRight, Copy, Filter, Pencil, Pin, PinOff, Plus, Printer, Users, X } from "lucide-react";
import {
  addScheduleCook,
  addScheduleItem,
  copyPreviousScheduleWeek,
  moveScheduleItem,
  removeScheduleCook,
  removeScheduleItem,
  renameScheduleCook,
  renameScheduleItem,
  saveScheduleNotes,
  setScheduleCell,
  setScheduleCellCooks,
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
import { firstName, groupByCell, uniqueUsers } from "@/lib/schedule/presence";
import { cookInitial, cookLoad, type GridCook } from "@/lib/schedule/cooks";
import { useScheduleRealtime } from "@/components/stock/use-schedule-realtime";

export type GridItem = { id: string; section: ScheduleSection; name: string };

type MenuState = { itemId: string; weekday: number; top: number; left: number };
type CookMenuState = { itemId: string; weekday: number; section: ScheduleSection; top: number; left: number };
type TeamMenuState = { section: ScheduleSection; top: number; left: number };

const FREEZE_KEY = "cronograma:coluna-congelada";
const FREEZE_EVENT = "cronograma:coluna-congelada-mudou";

// a escolha de congelar fica guardada neste aparelho; sem armazenamento (janela anônima etc.) vale até fechar a página
let frozenInMemory = false;
const readFrozen = () => {
  try {
    return localStorage.getItem(FREEZE_KEY) === "1";
  } catch {
    return frozenInMemory;
  }
};
const writeFrozen = (value: boolean) => {
  frozenInMemory = value;
  try {
    localStorage.setItem(FREEZE_KEY, value ? "1" : "0");
  } catch {
    // fica só na memória
  }
  window.dispatchEvent(new Event(FREEZE_EVENT));
};
const subscribeFrozen = (onChange: () => void) => {
  window.addEventListener(FREEZE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(FREEZE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};

const TONE: Record<LabelTone, string> = {
  produce: "bg-orange-100 text-orange-800 print:bg-orange-500 print:text-white",
  prep: "bg-amber-50 text-amber-800 print:bg-amber-200 print:text-amber-900",
  thaw: "bg-sky-100 text-sky-800 print:bg-sky-500 print:text-white",
  free: "bg-neutral-100 text-neutral-700 print:bg-neutral-200 print:text-neutral-800",
};

// on screen the block header is a soft tint; printed it is a solid band in the block's colour
const SECTION_STYLE: Record<ScheduleSection, { title: string; day: string }> = {
  salgados: { title: "bg-orange-100 print:bg-orange-600", day: "bg-orange-100 print:bg-orange-100" },
  folheados: { title: "bg-amber-100 print:bg-amber-500", day: "bg-amber-100 print:bg-amber-100" },
  paes: { title: "bg-stone-200 print:bg-stone-600", day: "bg-stone-200 print:bg-stone-200" },
  cozinha: { title: "bg-emerald-100 print:bg-emerald-700", day: "bg-emerald-100 print:bg-emerald-100" },
};

export function ScheduleGrid({
  weekStart,
  dates,
  items,
  initialCells,
  initialCellCooks,
  cooks,
  initialNotes,
  canEdit,
  me,
}: {
  weekStart: string;
  dates: string[];
  items: GridItem[];
  initialCells: Record<string, string>;
  /** "produto:dia" → ids das pessoas da equipe que fazem a atividade */
  initialCellCooks: Record<string, string[]>;
  /** equipe de cada setor */
  cooks: GridCook[];
  initialNotes: string;
  canEdit: boolean;
  me: { id: string; name: string };
}) {
  const router = useRouter();
  const [cells, setCells] = useState(initialCells);
  const [cellCooks, setCellCooks] = useState(initialCellCooks);
  const [cookMenu, setCookMenu] = useState<CookMenuState | null>(null);
  const [teamMenu, setTeamMenu] = useState<TeamMenuState | null>(null);
  // visão individual de cada setor: só as tarefas dessa pessoa ficam em destaque
  const [focusCook, setFocusCook] = useState<Record<string, string>>({});
  const cookMenuRef = useRef<HTMLDivElement>(null);
  const teamMenuRef = useRef<HTMLDivElement>(null);
  const cooksBySection = useMemo(() => {
    const map = new Map<string, GridCook[]>();
    for (const c of cooks) map.set(c.section, [...(map.get(c.section) ?? []), c]);
    return map;
  }, [cooks]);
  const cookById = useMemo(() => new Map(cooks.map((c) => [c.id, c])), [cooks]);
  const [notes, setNotes] = useState(initialNotes);
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [printedAt, setPrintedAt] = useState("");
  // blocks start expanded; clicking a block's title collapses it (printing always shows everything)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  function toggleBlock(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  const [, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  // coluna dos produtos congelada, como no Google Planilhas: ela fica parada e os dias rolam de lado,
  // cada setor com a sua barra (e as barras andam juntas).
  const frozen = useSyncExternalStore(subscribeFrozen, readFrozen, () => false);
  const toggleFrozen = () => writeFrozen(!frozen);
  const scrollers = useRef(new Map<string, HTMLElement>());
  // as barras dos setores andam juntas, mas só a que a pessoa está usando (a que o ponteiro ou o dedo tocou por último)
  // comanda as outras: o rolar das demais é só eco e é ignorado, para uma barra nunca puxar a outra de volta
  const leader = useRef<HTMLElement | null>(null);
  const takeLead = (e: React.SyntheticEvent<HTMLElement>) => {
    leader.current = e.currentTarget;
  };
  function syncScroll(from: HTMLElement) {
    if (!frozen) return;
    if (leader.current && leader.current !== from) return;
    leader.current = from;
    scrollers.current.forEach((el) => {
      if (el !== from && el.scrollLeft !== from.scrollLeft) el.scrollLeft = from.scrollLeft;
    });
  }
  // congelada, a tabela tem larguras fixas (produtos, 5 dias e um espaço depois de sexta) para a barra sempre poder
  // andar e encostar qualquer dia na coluna parada, mesmo numa tela larga onde os 5 dias já cabem
  const rowLine = frozen ? "border-t border-neutral-100 print:border-t-0" : "";
  const frozenCell = frozen ? "sticky left-0 z-20 shadow-[inset_-2px_0_0_#d4d4d8] print:static print:shadow-none" : "";

  // ao vivo: o que os outros marcam aparece na hora, e cada pessoa tem uma cor e um nome na célula que está usando
  const notesFocused = useRef(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(refreshTimer.current), []);
  const realtime = useScheduleRealtime(weekStart, me, {
    onCell: (itemId, weekday, label, cookIds) => {
      const key = `${itemId}:${weekday}`;
      setCells((prev) => {
        if ((prev[key] ?? null) === label) return prev;
        const next = { ...prev };
        if (label) next[key] = label;
        else delete next[key];
        return next;
      });
      setCellCooks((prev) => {
        const current = prev[key] ?? [];
        const incoming = label ? cookIds : [];
        if (current.length === incoming.length && current.every((id, i) => id === incoming[i])) return prev;
        const next = { ...prev };
        if (incoming.length) next[key] = incoming;
        else delete next[key];
        return next;
      });
    },
    onWeek: (week) => {
      if (!notesFocused.current) setNotes(week.notes);
    },
    onItemsChanged: () => {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 400);
    },
  });
  const othersByCell = useMemo(() => groupByCell(realtime.others), [realtime.others]);
  const notesEditors = realtime.others.filter((o) => o.notes);
  const people = uniqueUsers(realtime.others);
  const selectCell = realtime.select;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") selectCell(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectCell]);

  // which blocks go to the printer: the print button opens a small chooser (all blocks by default)
  const [printOpen, setPrintOpen] = useState(false);
  const [printSections, setPrintSections] = useState<Set<string>>(() => new Set(SCHEDULE_SECTIONS.map((s) => s.key)));
  const printRef = useRef<HTMLDivElement>(null);
  const allPrintSelected = printSections.size === SCHEDULE_SECTIONS.length;
  // null = follow the recommendation for the selected blocks; otherwise the user's choice
  const [orientationChoice, setOrientationChoice] = useState<"landscape" | "portrait" | null>(null);
  function togglePrintSection(key: string) {
    setPrintSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  useEffect(() => {
    if (!printOpen) return;
    const close = (e: MouseEvent) => {
      if (printRef.current && !printRef.current.contains(e.target as Node)) setPrintOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [printOpen]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  useEffect(() => {
    if (!cookMenu && !teamMenu) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (cookMenu && cookMenuRef.current && !cookMenuRef.current.contains(target)) setCookMenu(null);
      if (teamMenu && teamMenuRef.current && !teamMenuRef.current.contains(target)) setTeamMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [cookMenu, teamMenu]);

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

  // quantas tarefas cada pessoa tem em cada dia, por setor (para equilibrar a equipe)
  const loadBySection = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const b of bySection) map.set(b.key, cookLoad(cells, cellCooks, new Set(b.items.map((i) => i.id))));
    return map;
  }, [bySection, cells, cellCooks]);

  // Fitting the printout on one A4 page: the rows share the page height left after the title,
  // the notes and the legend (~62 mm) and each block's header (~13 mm). Below ~3.2 mm per row the
  // type would be unreadable, so then the rows keep their normal size and the blocks flow over pages.
  const printPlan = useMemo(() => {
    const chosen = bySection.filter((b) => printSections.has(b.key));
    const rows = chosen.reduce((sum, b) => sum + b.items.length, 0);
    const pageHeight = { landscape: 194, portrait: 281 };
    const rowFor = (o: "landscape" | "portrait") =>
      rows === 0 ? 6 : (pageHeight[o] - 62 - 13 * chosen.length) / rows;
    const recommended: "landscape" | "portrait" = rowFor("landscape") >= 3.8 ? "landscape" : "portrait";
    const orientation = orientationChoice ?? recommended;
    const fitRow = rowFor(orientation);
    return { orientation, recommended, fit: rows > 0 && fitRow >= 3.2, rowMm: Math.min(5.2, fitRow) };
  }, [bySection, printSections, orientationChoice]);
  const printCss = `@media print { @page { size: A4 ${printPlan.orientation}; margin: 8mm; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }${
    printPlan.fit
      ? ` .sched-fit section tbody tr { height: ${printPlan.rowMm}mm; } .sched-fit section tbody td { padding-top: 0 !important; padding-bottom: 0 !important; } .sched-fit section tbody td span:not([data-avatar]) { font-size: ${(printPlan.rowMm * 0.6).toFixed(2)}mm !important; line-height: 1 !important; } .sched-fit section tbody td button { font-size: ${(printPlan.rowMm * 0.55).toFixed(2)}mm !important; min-height: 0 !important; height: ${(printPlan.rowMm * 0.8).toFixed(2)}mm !important; padding-top: 0 !important; padding-bottom: 0 !important; line-height: 1 !important; }`
      : ""
  } }`;

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
    const previousCooks = cellCooks[key];
    setCells((prev) => {
      const next = { ...prev };
      if (label) next[key] = label;
      else delete next[key];
      return next;
    });
    if (!label && previousCooks) {
      setCellCooks((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    setMenu(null);
    setCustom("");
    run(
      () => setScheduleCell({ week_start: weekStart, item_id: itemId, weekday, label }),
      () => {
        setCells((prev) => {
          const next = { ...prev };
          if (previous) next[key] = previous;
          else delete next[key];
          return next;
        });
        if (!label && previousCooks) setCellCooks((prev) => ({ ...prev, [key]: previousCooks }));
      }
    );
  }

  function openCookMenu(e: React.MouseEvent<HTMLElement>, itemId: string, weekday: number, section: ScheduleSection) {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = 208;
    setMenu(null);
    setTeamMenu(null);
    setCookMenu({
      itemId,
      weekday,
      section,
      top: Math.min(rect.bottom + 4, window.innerHeight - 300),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    });
  }

  function openTeamMenu(e: React.MouseEvent<HTMLElement>, section: ScheduleSection) {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = 288;
    setMenu(null);
    setCookMenu(null);
    setTeamMenu({
      section,
      top: Math.min(rect.bottom + 4, window.innerHeight - 380),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    });
  }

  function toggleCook(itemId: string, weekday: number, cookId: string) {
    const key = `${itemId}:${weekday}`;
    const current = cellCooks[key] ?? [];
    const next = current.includes(cookId) ? current.filter((id) => id !== cookId) : [...current, cookId];
    const write = (ids: string[]) =>
      setCellCooks((prev) => {
        const copy = { ...prev };
        if (ids.length) copy[key] = ids;
        else delete copy[key];
        return copy;
      });
    write(next);
    run(
      () => setScheduleCellCooks({ week_start: weekStart, item_id: itemId, weekday, cook_ids: next }),
      () => write(current)
    );
  }

  function openMenu(e: React.MouseEvent<HTMLButtonElement>, itemId: string, weekday: number) {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = 176;
    setCustom("");
    setCookMenu(null);
    setTeamMenu(null);
    selectCell(`${itemId}:${weekday}`);
    setMenu({
      itemId,
      weekday,
      top: Math.min(rect.bottom + 4, window.innerHeight - 380),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    });
  }

  return (
    <div className="sched-fit space-y-4">
      <style>{printCss}</style>

      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        {people.length > 0 && (
          <div className="mr-auto flex items-center gap-2" aria-label="Quem está com o cronograma aberto">
            <div className="flex -space-x-1.5">
              {people.map((o) => (
                <span
                  key={o.userId}
                  title={`${o.name} está nesta semana`}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold uppercase text-white"
                  style={{ backgroundColor: o.color }}
                >
                  {firstName(o.name).charAt(0)}
                </span>
              ))}
            </div>
            <span className="text-xs text-neutral-500">
              {people.length === 1
                ? people[0].userId === me.id
                  ? "Você tem outra aba aberta nesta semana"
                  : `${firstName(people[0].name)} também está aqui`
                : `${people.length} pessoas também estão aqui`}
            </span>
          </div>
        )}
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
        <div ref={printRef} className="relative">
          <button
            type="button"
            onClick={() => setPrintOpen((v) => !v)}
            aria-expanded={printOpen}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </button>
          {printOpen && (
            <div className="absolute right-0 top-full z-40 mt-1.5 w-64 rounded-lg border border-neutral-200 bg-white p-3 shadow-xl">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-neutral-900">Quais setores imprimir?</p>
                <button
                  type="button"
                  onClick={() =>
                    setPrintSections(allPrintSelected ? new Set() : new Set(SCHEDULE_SECTIONS.map((s) => s.key)))
                  }
                  className="text-[11px] font-medium text-orange-700 hover:text-orange-800"
                >
                  {allPrintSelected ? "Desmarcar todos" : "Marcar todos"}
                </button>
              </div>
              <div className="space-y-0.5">
                {SCHEDULE_SECTIONS.map((section) => {
                  const checked = printSections.has(section.key);
                  return (
                    <label
                      key={section.key}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm text-neutral-800 hover:bg-neutral-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePrintSection(section.key)}
                        className="sr-only"
                      />
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                          checked ? "border-orange-600 bg-orange-600 text-white" : "border-neutral-300 bg-white"
                        }`}
                      >
                        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      {section.label}
                    </label>
                  );
                })}
              </div>
              <div className="mt-3 border-t border-neutral-100 pt-2.5">
                <p className="mb-1.5 text-xs font-semibold text-neutral-900">Orientação da folha</p>
                <div className="inline-flex w-full rounded-lg border border-neutral-200 bg-white p-0.5 text-xs">
                  {(
                    [
                      ["landscape", "Paisagem"],
                      ["portrait", "Retrato"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setOrientationChoice(value)}
                      className={`flex-1 rounded-md px-2 py-1.5 font-medium ${
                        printPlan.orientation === value ? "bg-orange-600 text-white" : "text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-neutral-500">
                  {printPlan.fit
                    ? "A seleção é ajustada para caber em uma folha."
                    : "Muitos produtos para uma folha nesta orientação: eles seguem em mais de uma página, sem partir um setor ao meio."}
                  {orientationChoice === null && printPlan.orientation === "portrait" && printPlan.recommended === "portrait"
                    ? " Retrato recomendado para esta seleção."
                    : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={printSections.size === 0}
                onClick={() => {
                  setPrintOpen(false);
                  // let the chooser close before the print dialog freezes the page
                  setTimeout(() => window.print(), 50);
                }}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir selecionados
              </button>
            </div>
          )}
        </div>
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

      {frozen && (
        <p className="text-xs text-neutral-500 print:hidden">
          Coluna congelada: arraste a barra de rolagem que fica embaixo de cada setor (ou use Shift + roda do mouse) para
          mover os dias até perto da coluna dos produtos.
        </p>
      )}

      {bySection.map((section) => {
        const style = SECTION_STYLE[section.key];
        const secCooks = cooksBySection.get(section.key) ?? [];
        const secLoad = loadBySection.get(section.key);
        const focus = secCooks.some((c) => c.id === focusCook[section.key]) ? focusCook[section.key] : "";
        const rowHasFocus = (itemId: string) =>
          SCHEDULE_WEEKDAYS.some((d) => (cellCooks[`${itemId}:${d.n}`] ?? []).includes(focus) && cells[`${itemId}:${d.n}`]);
        return (
          <section
            key={section.key}
            ref={(el) => {
              if (el) scrollers.current.set(section.key, el);
              else scrollers.current.delete(section.key);
            }}
            onScroll={(e) => syncScroll(e.currentTarget)}
            onPointerEnter={takeLead}
            onPointerDown={takeLead}
            onTouchStart={takeLead}
            onWheel={takeLead}
            className={`${
              frozen ? "overflow-x-scroll [scrollbar-color:#a3a3a3_#f5f5f5]" : "overflow-x-auto"
            } rounded-lg border border-neutral-200 bg-white print:break-inside-avoid print:overflow-visible print:rounded-md print:border-neutral-300 ${
              printSections.has(section.key) ? "" : "print:hidden"
            }`}
          >
            <table
              className={`${
                frozen
                  ? "table-fixed w-[calc(10rem+60rem+60vw)] sm:w-[calc(24rem+60rem+60vw)] print:w-full print:table-auto"
                  : "w-full min-w-[640px]"
              } ${
                frozen ? "border-separate border-spacing-0 print:border-collapse" : "border-collapse"
              } text-left text-sm print:min-w-0 print:text-[10px]`}
            >
              {frozen && (
                <colgroup>
                  <col className="w-40 sm:w-[24rem] print:w-auto" />
                  {SCHEDULE_WEEKDAYS.map((d) => (
                    <col key={d.n} className="w-48 print:w-auto" />
                  ))}
                  <col className="w-[60vw] print:w-auto" />
                </colgroup>
              )}
              <thead>
                <tr>
                  <th className={`px-3 py-2 text-xs font-bold uppercase tracking-wide text-neutral-900 print:py-1.5 print:text-[10px] print:tracking-widest print:text-white ${style.title} ${frozenCell}`}>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleBlock(section.key)}
                        aria-expanded={!collapsed.has(section.key)}
                        className="flex items-center gap-1.5 uppercase"
                      >
                        <ChevronRight
                          className={`h-3.5 w-3.5 transition-transform print:hidden ${collapsed.has(section.key) ? "" : "rotate-90"}`}
                        />
                        {section.label}
                      </button>
                      <div className="flex shrink-0 items-center gap-1 print:hidden">
                        {secCooks.length > 0 && (
                          <label className="flex items-center gap-0.5" title="Visão individual: destaca só as tarefas de uma pessoa">
                            <Filter className="h-3 w-3 text-neutral-500" />
                            <select
                              value={focus}
                              onChange={(e) => setFocusCook((prev) => ({ ...prev, [section.key]: e.target.value }))}
                              aria-label={`Visão individual: ${section.label}`}
                              className={`max-w-[5.5rem] rounded border px-1 py-0.5 text-[10px] font-semibold normal-case tracking-normal ${
                                focus ? "border-orange-500 bg-white text-orange-700" : "border-black/10 bg-white/70 text-neutral-700"
                              }`}
                            >
                              <option value="">Todas</option>
                              {secCooks.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={(e) => (teamMenu?.section === section.key ? setTeamMenu(null) : openTeamMenu(e, section.key))}
                            title="Gestão de equipe deste setor"
                            aria-label={`Gestão de equipe: ${section.label}`}
                            className={`rounded p-0.5 transition-colors ${
                              teamMenu?.section === section.key
                                ? "bg-white/70 text-orange-700"
                                : "text-neutral-500 hover:bg-white/60 hover:text-neutral-900"
                            }`}
                          >
                            <Users className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={toggleFrozen}
                          aria-pressed={frozen}
                          title={frozen ? "Descongelar a coluna dos produtos" : "Congelar a coluna dos produtos"}
                          aria-label={frozen ? "Descongelar a coluna dos produtos" : "Congelar a coluna dos produtos"}
                          className={`shrink-0 rounded p-0.5 transition-colors ${
                            frozen ? "bg-white/70 text-orange-700" : "text-neutral-500 hover:bg-white/60 hover:text-neutral-900"
                          }`}
                        >
                          {frozen ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </th>
                  {SCHEDULE_WEEKDAYS.map((d, i) => (
                    <th key={d.n} className={`w-[14%] px-2 py-1.5 text-center print:py-1 ${style.day}`}>
                      <div className="text-[11px] font-bold uppercase text-neutral-800 print:text-[9px]">{d.label}</div>
                      <div className="text-[10px] font-normal text-neutral-500 print:text-[8px] print:text-neutral-600">{formatBrDate(dates[i])}</div>
                      {secCooks.length > 0 && (
                        <div
                          className="mt-0.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0 text-[9px] font-semibold leading-tight text-neutral-700 print:hidden"
                          aria-label="Tarefas de cada pessoa neste dia"
                        >
                          {secCooks.map((c) => {
                            const n = secLoad?.get(`${c.id}:${d.n}`) ?? 0;
                            return (
                              <span
                                key={c.id}
                                title={`${c.name}: ${n} ${n === 1 ? "tarefa" : "tarefas"}`}
                                className={`inline-flex items-center gap-0.5 whitespace-nowrap ${n === 0 ? "opacity-50" : ""}`}
                              >
                                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                                {c.name}: {n}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </th>
                  ))}
                  {frozen && <th aria-hidden className="bg-white print:hidden" />}
                </tr>
              </thead>
              <tbody className={collapsed.has(section.key) ? "hidden print:table-row-group" : undefined}>
                {section.items.map((item, index) => (
                  <tr key={item.id} className="break-inside-avoid border-t border-neutral-100 print:border-neutral-200 print:even:bg-neutral-50">
                    <td
                      className={`px-3 py-1 text-neutral-900 transition-opacity print:py-px ${rowLine} ${frozen ? `${frozenCell} bg-white` : ""} ${
                        focus && !rowHasFocus(item.id) ? "opacity-30" : ""
                      }`}
                    >
                      {editing ? (
                        <EditableName
                          key={`${item.id}:${item.name}`}
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
                      const here = othersByCell.get(`${item.id}:${d.n}`);
                      const assigned = (cellCooks[`${item.id}:${d.n}`] ?? [])
                        .map((id) => cookById.get(id))
                        .filter((c): c is GridCook => !!c && c.section === section.key);
                      const dim = !!focus && !(label && assigned.some((c) => c.id === focus));
                      return (
                        <td
                          key={d.n}
                          className={`relative border-l border-neutral-100 ${rowLine} px-1 py-0.5 text-center print:border-neutral-200 print:px-0.5 print:py-px`}
                        >
                          {here && (
                            <span
                              aria-hidden
                              className="pointer-events-none absolute inset-0 z-10 rounded-[3px] border-2 print:hidden"
                              style={{ borderColor: here[0].color }}
                            >
                              <span
                                className="absolute -top-[17px] -left-0.5 flex max-w-[140%] items-center whitespace-nowrap rounded-t-[3px] px-1.5 text-[10px] font-semibold leading-[15px] text-white"
                                style={{ backgroundColor: here[0].color }}
                              >
                                {here.map((c) => firstName(c.name)).join(", ")}
                              </span>
                            </span>
                          )}
                          <div
                            className={`group/cell flex min-h-6 items-center gap-0.5 rounded transition-opacity print:min-h-0 ${
                              label ? TONE[labelTone(label)] : ""
                            } ${dim ? "opacity-25" : ""}`}
                          >
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={(e) => openMenu(e, item.id, d.n)}
                              title={label}
                              className={`min-h-6 min-w-0 flex-1 truncate rounded px-1 py-0.5 text-[11px] font-semibold uppercase print:min-h-0 print:text-[8.5px] print:leading-tight ${
                                label ? "" : canEdit ? "text-transparent hover:bg-neutral-100 hover:text-neutral-300 print:hover:bg-transparent print:hover:text-transparent" : "text-transparent"
                              }`}
                            >
                              {label ?? "+"}
                            </button>
                            {label && assigned.length > 0 && (
                              <button
                                type="button"
                                disabled={!canEdit}
                                onClick={(e) => openCookMenu(e, item.id, d.n, section.key)}
                                title={`Quem faz: ${assigned.map((c) => c.name).join(", ")}`}
                                aria-label="Mudar quem faz esta atividade"
                                className="flex shrink-0 items-center rounded px-0.5 py-0.5 disabled:cursor-default"
                              >
                                <span className={assigned.length > 2 ? "flex -space-x-1" : "flex space-x-0.5"}>
                                  {assigned.map((c) => (
                                    <Avatar key={c.id} cook={c} />
                                  ))}
                                </span>
                              </button>
                            )}
                            {label && assigned.length === 0 && canEdit && secCooks.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => openCookMenu(e, item.id, d.n, section.key)}
                                title="Escolher quem faz esta atividade"
                                aria-label="Escolher quem faz esta atividade"
                                className="mr-0.5 shrink-0 rounded p-0.5 text-current opacity-0 transition-opacity hover:bg-white/60 focus-visible:opacity-100 group-hover/cell:opacity-70 print:hidden"
                              >
                                <Users className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    {frozen && <td aria-hidden className={`${rowLine} print:hidden`} />}
                  </tr>
                ))}
                {editing && (
                  <tr className="border-t border-neutral-100 print:hidden">
                    <td colSpan={frozen ? 7 : 6} className="px-3 py-1.5">
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
          {notesEditors.map((o) => (
            <span
              key={o.tab}
              className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-white print:hidden"
              style={{ backgroundColor: o.color }}
            >
              {firstName(o.name)} está escrevendo
            </span>
          ))}
        </label>
        {canEdit ? (
          <textarea
            id="schedule-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onFocus={() => {
              notesFocused.current = true;
              realtime.setTypingNotes(true);
            }}
            onBlur={() => {
              notesFocused.current = false;
              realtime.setTypingNotes(false);
              run(() => saveScheduleNotes({ week_start: weekStart, notes }));
            }}
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

      {cookMenu && (
        <div
          ref={cookMenuRef}
          style={{ top: cookMenu.top, left: cookMenu.left }}
          className="fixed z-50 w-52 rounded-lg border border-neutral-200 bg-white py-1.5 shadow-xl print:hidden"
        >
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Quem faz</p>
          {(cooksBySection.get(cookMenu.section) ?? []).map((c) => {
            const checked = (cellCooks[`${cookMenu.itemId}:${cookMenu.weekday}`] ?? []).includes(c.id);
            return (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-neutral-800 hover:bg-neutral-50">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCook(cookMenu.itemId, cookMenu.weekday, c.id)}
                  className="sr-only"
                />
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border ${
                    checked ? "border-transparent text-white" : "border-neutral-300 bg-white"
                  }`}
                  style={checked ? { backgroundColor: c.color } : undefined}
                >
                  {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <Avatar cook={c} />
                <span className="truncate">{c.name}</span>
              </label>
            );
          })}
        </div>
      )}

      {teamMenu && (
        <TeamMenu
          menuRef={teamMenuRef}
          top={teamMenu.top}
          left={teamMenu.left}
          section={teamMenu.section}
          label={SCHEDULE_SECTIONS.find((s) => s.key === teamMenu.section)?.label ?? ""}
          cooks={cooksBySection.get(teamMenu.section) ?? []}
          run={run}
          onClose={() => setTeamMenu(null)}
        />
      )}
    </div>
  );
}

type Runner = (action: () => Promise<ScheduleResult>, onFail?: () => void, refresh?: boolean) => void;

/** Bolinha com a inicial da pessoa, na cor dela. */
function Avatar({ cook }: { cook: GridCook }) {
  return (
    <span
      data-avatar
      title={cook.name}
      style={{ backgroundColor: cook.color }}
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white text-[9px] font-bold leading-none text-white print:h-[2.8mm] print:w-[2.8mm] print:text-[5.5px]"
    >
      {cookInitial(cook.name)}
    </span>
  );
}

/** Gestão da equipe de um setor: quem faz parte (cada pessoa tem uma cor) e as tarefas se atribuem em cada célula. */
function TeamMenu({
  menuRef,
  top,
  left,
  section,
  label,
  cooks,
  run,
  onClose,
}: {
  menuRef: React.RefObject<HTMLDivElement | null>;
  top: number;
  left: number;
  section: ScheduleSection;
  label: string;
  cooks: GridCook[];
  run: Runner;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  return (
    <div
      ref={menuRef}
      style={{ top, left }}
      className="fixed z-50 w-72 rounded-lg border border-neutral-200 bg-white p-3 shadow-xl print:hidden"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-neutral-900">Equipe · {label}</p>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {cooks.length === 0 && (
        <p className="mb-2 text-xs text-neutral-500">Ninguém na equipe ainda. Adicione as pessoas abaixo.</p>
      )}
      <ul className="space-y-1">
        {cooks.map((c) => (
          <TeamRow key={`${c.id}:${c.name}`} cook={c} run={run} />
        ))}
      </ul>
      <form
        className="mt-2 flex gap-1 border-t border-neutral-100 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          run(() => addScheduleCook({ section, name }), undefined, true);
          setName("");
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Nome da pessoa"
          className="min-w-0 flex-1 rounded border border-neutral-300 px-1.5 py-1 text-base sm:text-xs"
        />
        <button type="submit" className="rounded bg-orange-600 px-2.5 text-xs font-semibold text-white">
          Adicionar
        </button>
      </form>
      <p className="mt-2 text-[11px] leading-snug text-neutral-500">
        Depois, em cada atividade marcada, clique no ícone de pessoas para dizer quem faz.
      </p>
    </div>
  );
}

function TeamRow({ cook, run }: { cook: GridCook; run: Runner }) {
  const [name, setName] = useState(cook.name);
  return (
    <li className="flex items-center gap-2">
      <Avatar cook={{ ...cook, name }} />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name.trim() !== cook.name && run(() => renameScheduleCook({ id: cook.id, name }), () => setName(cook.name), true)}
        maxLength={40}
        aria-label={`Nome de ${cook.name}`}
        className="min-w-0 flex-1 rounded border border-neutral-200 px-1.5 py-0.5 text-base sm:text-xs"
      />
      <button
        type="button"
        onClick={() =>
          confirm(`Tirar "${cook.name}" da equipe? As tarefas dela ficam sem responsável.`) &&
          run(() => removeScheduleCook({ id: cook.id }), undefined, true)
        }
        className="rounded p-0.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
        aria-label={`Tirar ${cook.name} da equipe`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

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
