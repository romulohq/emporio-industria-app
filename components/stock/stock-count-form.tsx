"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronRight, Eraser, Pencil, Pin, Printer } from "lucide-react";
import { MarkerIcon } from "@/components/icons/marker-icon";
import { CoverageBar } from "@/components/stock/coverage-bar";
import {
  autosaveStockCount,
  saveStockCount,
  updateProductLimits,
  updateProductUnit,
  type SaveCountState,
} from "@/app/(app)/estoque/contagem-actions";
import { unitOptionsFor } from "@/lib/format/units";
import { setPinnedDate, usePinnedDate } from "@/lib/stock/pinned-date";
import { HIGHLIGHT_COLORS, clearHighlights, setHighlight, useHighlights } from "@/lib/stock/highlights";
import { StockPrintReport, type PrintGroup } from "@/components/stock/stock-print-report";
import { coverageOf, stockUnits } from "@/lib/stock/coverage";

export type CountRow = {
  id: string;
  name: string;
  unit: string;
  min: number;
  unitsPerBox: number;
  /** boxes already saved for this day, if any */
  boxes: number | null;
};

type Limits = { min: number; per: number };
type Draft = { min: string; per: string };

const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n);

/** A draft field counts only when it is a valid number (minimum >= 0, per box > 0). */
function parseDraft(draft: Draft | undefined, saved: Limits): Limits {
  if (!draft) return saved;
  const min = draft.min.trim() === "" ? NaN : Number(draft.min);
  const per = draft.per.trim() === "" ? NaN : Number(draft.per);
  return {
    min: Number.isFinite(min) && min >= 0 ? min : saved.min,
    per: Number.isFinite(per) && per > 0 ? per : saved.per,
  };
}

export function StockCountForm({
  date,
  groups,
  canEdit,
}: {
  date: string;
  groups: { sectorName: string; rows: CountRow[] }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const pinnedDate = usePinnedDate();
  const isPinned = pinnedDate !== null;
  const [state, formAction, pending] = useActionState<SaveCountState, FormData>(saveStockCount, undefined);
  const allRows = useMemo(() => groups.flatMap((g) => g.rows), [groups]);
  const [initialValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(allRows.map((r) => [r.id, r.boxes === null ? "" : String(r.boxes)]))
  );
  const [values, setValues] = useState(initialValues);

  // autosave: boxes typed are sent shortly after the last keystroke, only what differs from what is saved.
  // Refs (not effects) so a pending save still goes out if the user leaves the screen right away.
  const valuesRef = useRef(initialValues);
  const savedBoxes = useRef<Record<string, number>>(
    Object.fromEntries(allRows.filter((r) => r.boxes !== null).map((r) => [r.id, r.boxes as number]))
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingNow = useRef(false);
  const [autoStatus, setAutoStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [autoError, setAutoError] = useState<string | null>(null);

  const pendingEntries = () =>
    Object.entries(valuesRef.current)
      .filter(([, v]) => v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= 0)
      .map(([product_id, v]) => ({ product_id, boxes: Number(v) }))
      .filter((e) => savedBoxes.current[e.product_id] !== e.boxes);

  async function flushAutosave() {
    if (savingNow.current) return;
    savingNow.current = true;
    setAutoStatus("saving");
    try {
      for (let batch = pendingEntries(); batch.length > 0; batch = pendingEntries()) {
        const result = await autosaveStockCount({ count_date: date, entries: batch });
        if (result?.error) {
          setAutoError(result.error);
          setAutoStatus("error");
          return;
        }
        for (const e of batch) savedBoxes.current[e.product_id] = e.boxes;
      }
      setAutoError(null);
      setAutoStatus("saved");
    } catch {
      setAutoError("Sem conexão: a contagem será salva na próxima alteração.");
      setAutoStatus("error");
    } finally {
      savingNow.current = false;
    }
  }

  function changeBoxes(productId: string, value: string) {
    valuesRef.current = { ...valuesRef.current, [productId]: value };
    setValues(valuesRef.current);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flushAutosave, 700);
  }

  // unit of measure per product, changed in place (saved right away)
  const [units, setUnits] = useState<Record<string, string>>({});
  const [unitError, setUnitError] = useState<string | null>(null);
  async function changeUnit(productId: string, unit: string) {
    const previous = units[productId];
    setUnits((prev) => ({ ...prev, [productId]: unit }));
    setUnitError(null);
    const result = await updateProductUnit({ product_id: productId, unit });
    if (result.error) {
      setUnitError(result.error);
      setUnits((prev) => {
        const next = { ...prev };
        if (previous === undefined) delete next[productId];
        else next[productId] = previous;
        return next;
      });
    }
  }

  // minimum stock and units per box: saved values, plus a draft while the edit mode is on
  const [saved, setSaved] = useState<Record<string, Limits>>(() =>
    Object.fromEntries(allRows.map((r) => [r.id, { min: r.min, per: r.unitsPerBox }]))
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [limitsError, setLimitsError] = useState<string | null>(null);
  const [limitsSaving, setLimitsSaving] = useState(false);
  const [limitsSaved, setLimitsSaved] = useState(false);

  const limitsFor = (id: string): Limits => (editing ? parseDraft(draft[id], saved[id]) : saved[id]);

  const changedLimits = useMemo(
    () =>
      Object.entries(draft)
        .map(([id, d]) => ({ id, next: parseDraft(d, saved[id]) }))
        .filter(({ id, next }) => next.min !== saved[id].min || next.per !== saved[id].per),
    [draft, saved]
  );

  function startEditing() {
    setDraft(Object.fromEntries(allRows.map((r) => [r.id, { min: String(saved[r.id].min), per: String(saved[r.id].per) }])));
    setLimitsError(null);
    setLimitsSaved(false);
    setEditing(true);
  }

  async function saveLimits() {
    setLimitsSaving(true);
    setLimitsError(null);
    const result = await updateProductLimits(
      changedLimits.map(({ id, next }) => ({ product_id: id, min_quantity: next.min, units_per_box: next.per }))
    );
    setLimitsSaving(false);
    if (result.error) {
      setLimitsError(result.error);
      return;
    }
    setSaved((prev) => ({ ...prev, ...Object.fromEntries(changedLimits.map(({ id, next }) => [id, next])) }));
    setEditing(false);
    setLimitsSaved(true);
    router.refresh();
  }

  // highlighter: null = off; otherwise the colour in use, or "eraser"
  const highlights = useHighlights(date);
  const [pen, setPen] = useState<string | null>(null);
  function markProduct(productId: string) {
    if (pen === null) return;
    if (pen === "eraser" || highlights[productId] === pen) setHighlight(date, productId, null);
    else setHighlight(date, productId, pen);
  }

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  function toggleSection(name: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const entries = useMemo(
    () =>
      Object.entries(values)
        .filter(([, v]) => v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= 0)
        .map(([product_id, v]) => ({ product_id, boxes: Number(v) })),
    [values]
  );

  const printGroups: PrintGroup[] = groups.map((g) => ({
    sectorName: g.sectorName,
    rows: g.rows.map((r) => {
      const { min, per } = limitsFor(r.id);
      const raw = values[r.id] ?? "";
      const hasValue = raw.trim() !== "" && Number.isFinite(Number(raw));
      return {
        id: r.id,
        name: r.name,
        unit: units[r.id] ?? r.unit,
        stock: hasValue ? stockUnits(Number(raw), per) : null,
        min,
      };
    }),
  }));

  return (
    <>
    <form action={formAction} className="space-y-4 print:hidden">
      <input type="hidden" name="count_date" value={date} />
      <input type="hidden" name="entries" value={JSON.stringify(entries)} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          Data da contagem
          <input
            type="date"
            value={date}
            onChange={(e) => {
              if (!e.target.value) return;
              // while pinned, the pin follows the date being looked at
              if (isPinned) setPinnedDate(e.target.value);
              router.push(`/estoque?data=${e.target.value}`);
            }}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm text-neutral-900"
          />
        </label>
        <button
          type="button"
          onClick={() => setPinnedDate(isPinned ? null : date)}
          aria-pressed={isPinned}
          title={
            isPinned
              ? "Data fixada: a contagem abre nesta data ao trocar de aba ou menu, até você recarregar a página. Clique para soltar."
              : "Fixar esta data: ela é mantida ao trocar de aba ou menu, até você recarregar a página."
          }
          aria-label={isPinned ? "Soltar data" : "Fixar data"}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            isPinned ? "text-orange-600 hover:bg-orange-50" : "text-neutral-400 hover:bg-neutral-100 hover:text-orange-600"
          }`}
        >
          <Pin className={`h-4 w-4 ${isPinned ? "fill-orange-500" : ""}`} />
        </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canEdit && !editing && (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              <Pencil className="h-4 w-4" />
              Editar mínimos e caixas
            </button>
          )}
          <Link
            href="/estoque/folha"
            className="inline-flex items-center gap-1 text-sm font-medium text-orange-700 hover:text-orange-800"
          >
            <Printer className="h-4 w-4" />
            Folha de contagem
          </Link>
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={limitsSaving}
                className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveLimits}
                disabled={limitsSaving || changedLimits.length === 0}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
              >
                {limitsSaving ? "Salvando..." : `Salvar alterações (${changedLimits.length})`}
              </button>
            </>
          ) : (
            <button
              type="submit"
              disabled={pending || entries.length === 0}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {pending ? "Salvando..." : "Salvar contagem"}
            </button>
          )}
        </div>
      </div>

      {editing && (
        <p className="rounded-md bg-orange-50 px-3 py-2 text-xs text-orange-800">
          Modo de edição: altere o <b>mínimo</b> e a quantidade <b>por caixa</b> de qualquer produto e salve. As contagens
          já registradas não são recalculadas.
        </p>
      )}
      {autoStatus === "saving" && <p className="text-xs text-neutral-500">Salvando automaticamente...</p>}
      {autoStatus === "saved" && <p className="text-xs text-green-700">Contagem salva automaticamente.</p>}
      {autoStatus === "error" && autoError && <p className="text-sm text-red-600">{autoError}</p>}
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {unitError && <p className="text-sm text-red-600">{unitError}</p>}
      {limitsError && <p className="text-sm text-red-600">{limitsError}</p>}
      {limitsSaved && !editing && <p className="text-sm text-green-700">Mínimos e quantidades por caixa atualizados.</p>}
      {state?.saved !== undefined && !state.error && (
        <p className="text-sm text-green-700">Contagem salva — {state.saved} produtos.</p>
      )}

      {pen !== null && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
          <MarkerIcon className="h-4 w-4 text-orange-600" />
          <span className="font-medium text-neutral-800">Marca-texto</span>
          <span className="text-xs text-neutral-500">Escolha a cor e clique nos produtos. As marcas valem só para este dia.</span>
          <div className="ml-1 flex items-center gap-1.5">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setPen(c.value)}
                aria-label={c.label}
                title={c.label}
                aria-pressed={pen === c.value}
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                  pen === c.value ? "border-neutral-800" : "border-white shadow-[0_0_0_1px_rgb(212,212,212)]"
                }`}
                style={{ backgroundColor: c.value }}
              >
                {pen === c.value && <Check className="h-3 w-3 text-neutral-800" strokeWidth={3} />}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPen("eraser")}
              aria-label="Borracha"
              title="Borracha: clique num produto marcado para tirar a marca"
              aria-pressed={pen === "eraser"}
              className={`ml-1 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${
                pen === "eraser" ? "border-neutral-800 bg-neutral-100 text-neutral-900" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              <Eraser className="h-3.5 w-3.5" />
              Borracha
            </button>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs">
            {Object.keys(highlights).length > 0 && (
              <button type="button" onClick={() => clearHighlights(date)} className="font-medium text-neutral-500 hover:text-red-600 hover:underline">
                Limpar as marcas deste dia
              </button>
            )}
            <button type="button" onClick={() => setPen(null)} className="font-semibold text-orange-700 hover:underline">
              Concluir
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">
                <span className="inline-flex items-center gap-2">
                  Produto
                  <button
                    type="button"
                    onClick={() => setPen((current) => (current === null ? HIGHLIGHT_COLORS[0].value : null))}
                    aria-pressed={pen !== null}
                    aria-label="Marca-texto"
                    title="Marca-texto: escolha uma cor e clique nos produtos para marcar"
                    tabIndex={-1}
                    className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                      pen !== null ? "bg-orange-100 text-orange-700" : "text-neutral-400 hover:bg-neutral-100 hover:text-orange-600"
                    }`}
                  >
                    <MarkerIcon className="h-4 w-4" />
                  </button>
                </span>
              </th>
              <th className="px-3 py-2 text-right">Mínimo</th>
              <th className="px-3 py-2 text-right">Por caixa</th>
              <th className="px-3 py-2">Medida</th>
              <th className="px-3 py-2">Caixas</th>
              <th className="px-3 py-2 text-right">Estoque</th>
              <th className="w-[30%] min-w-56 px-4 py-2">Abastecimento</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <GroupRows
                key={group.sectorName}
                group={group}
                isCollapsed={collapsed.has(group.sectorName)}
                onToggle={() => toggleSection(group.sectorName)}
                values={values}
                changeBoxes={changeBoxes}
                units={units}
                changeUnit={changeUnit}
                canEdit={canEdit}
                highlights={highlights}
                pen={pen}
                onMark={markProduct}
                editing={editing}
                draft={draft}
                setDraft={setDraft}
                limitsFor={limitsFor}
              />
            ))}
          </tbody>
        </table>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Imprimir estoques</h2>
          <p className="text-xs text-neutral-500">
            Todos os estoques desta contagem em uma folha A4, coloridos pelo nível de abastecimento.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700"
        >
          <Printer className="h-4 w-4" />
          Imprimir estoques
        </button>
      </section>
    </form>
    <StockPrintReport date={date} groups={printGroups} />
    </>
  );
}

function GroupRows({
  group,
  isCollapsed,
  onToggle,
  values,
  changeBoxes,
  units,
  changeUnit,
  canEdit,
  highlights,
  pen,
  onMark,
  editing,
  draft,
  setDraft,
  limitsFor,
}: {
  group: { sectorName: string; rows: CountRow[] };
  isCollapsed: boolean;
  onToggle: () => void;
  values: Record<string, string>;
  changeBoxes: (productId: string, value: string) => void;
  units: Record<string, string>;
  changeUnit: (productId: string, unit: string) => void;
  canEdit: boolean;
  highlights: Record<string, string>;
  pen: string | null;
  onMark: (productId: string) => void;
  editing: boolean;
  draft: Record<string, Draft>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, Draft>>>;
  limitsFor: (id: string) => Limits;
}) {
  const editField =
    "w-20 rounded-md border border-orange-300 bg-orange-50/40 px-2 py-1 text-right text-base tabular-nums focus:border-orange-500 focus:outline-none sm:text-sm";
  return (
    <>
      <tr className="bg-neutral-50/70">
        <td colSpan={7} className="p-0">
          <button
            type="button"
            onClick={onToggle}
            tabIndex={-1}
            aria-expanded={!isCollapsed}
            className="flex w-full items-center gap-1.5 px-4 py-2.5 text-left text-sm font-bold uppercase tracking-wide text-neutral-500 hover:text-neutral-700"
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
            {group.sectorName}
            {isCollapsed && <span className="font-normal normal-case tracking-normal">· {group.rows.length} produtos</span>}
          </button>
        </td>
      </tr>
      {!isCollapsed && group.rows.map((row) => {
        const { min, per } = limitsFor(row.id);
        const unit = units[row.id] ?? row.unit;
        const raw = values[row.id] ?? "";
        const hasValue = raw.trim() !== "" && Number.isFinite(Number(raw));
        const stock = hasValue ? stockUnits(Number(raw), per) : null;
        const cov = stock === null ? null : coverageOf(stock, min);
        return (
          <tr key={row.id} className="border-t border-neutral-100">
            <td
              className={`px-4 py-1.5 text-neutral-800 ${pen !== null ? "cursor-pointer select-none" : ""}`}
              onClick={pen !== null ? () => onMark(row.id) : undefined}
            >
              <span
                className="rounded px-1 py-0.5 -mx-1 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
                style={highlights[row.id] ? { backgroundColor: highlights[row.id] } : undefined}
              >
                {row.name}
              </span>
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums text-neutral-500">
              {editing ? (
                <input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={draft[row.id]?.min ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, [row.id]: { ...prev[row.id], min: e.target.value } }))
                  }
                  aria-label={`Mínimo de ${row.name}`}
                  className={editField}
                />
              ) : (
                fmt(min)
              )}
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums text-neutral-400">
              {editing ? (
                <input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={draft[row.id]?.per ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, [row.id]: { ...prev[row.id], per: e.target.value } }))
                  }
                  aria-label={`Quantidade por caixa de ${row.name}`}
                  className={editField}
                />
              ) : (
                fmt(per)
              )}
            </td>
            <td className="px-3 py-1.5">
              {canEdit ? (
                <select
                  value={unit}
                  onChange={(ev) => changeUnit(row.id, ev.target.value)}
                  aria-label={`Medida de ${row.name}`}
                  // Tab runs down the "Caixas" column: the unit select is reached with the mouse
                  tabIndex={-1}
                  className="rounded-md border border-neutral-200 bg-white px-1.5 py-1 text-base text-neutral-700 sm:text-xs"
                >
                  {unitOptionsFor(row.unit).map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.value}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-neutral-500">{unit}</span>
              )}
            </td>
            <td className="px-3 py-1.5">
              <input
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={raw}
                onChange={(e) => changeBoxes(row.id, e.target.value)}
                className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-right text-base tabular-nums focus:border-orange-500 focus:outline-none sm:text-sm"
              />
            </td>
            <td className="px-3 py-1.5 text-right font-medium tabular-nums text-neutral-900">
              {stock === null ? "—" : `${fmt(stock)} ${unit}`}
            </td>
            <td className="px-4 py-1.5">
              {cov ? <CoverageBar ratio={cov.ratio} level={cov.level} /> : <span className="text-neutral-300">—</span>}
            </td>
          </tr>
        );
      })}
    </>
  );
}
