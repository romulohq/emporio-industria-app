"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Printer } from "lucide-react";
import { CoverageBar } from "@/components/stock/coverage-bar";
import { saveStockCount, updateProductUnit, type SaveCountState } from "@/app/(app)/estoque/contagem-actions";
import { unitOptionsFor } from "@/lib/format/units";
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

const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n);

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
  const [state, formAction, pending] = useActionState<SaveCountState, FormData>(saveStockCount, undefined);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(groups.flatMap((g) => g.rows).map((r) => [r.id, r.boxes === null ? "" : String(r.boxes)]))
  );

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

  const entries = useMemo(
    () =>
      Object.entries(values)
        .filter(([, v]) => v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= 0)
        .map(([product_id, v]) => ({ product_id, boxes: Number(v) })),
    [values]
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="count_date" value={date} />
      <input type="hidden" name="entries" value={JSON.stringify(entries)} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          Data da contagem
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && router.push(`/estoque?data=${e.target.value}`)}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm text-neutral-900"
          />
        </label>
        <div className="flex items-center gap-3">
          <Link
            href="/estoque/folha"
            className="inline-flex items-center gap-1 text-sm font-medium text-orange-700 hover:text-orange-800"
          >
            <Printer className="h-4 w-4" />
            Folha de contagem
          </Link>
          <button
            type="submit"
            disabled={pending || entries.length === 0}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
          >
            {pending ? "Salvando..." : `Salvar contagem (${entries.length})`}
          </button>
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {unitError && <p className="text-sm text-red-600">{unitError}</p>}
      {state?.saved !== undefined && !state.error && (
        <p className="text-sm text-green-700">Contagem salva — {state.saved} produtos.</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Produto</th>
              <th className="px-3 py-2 text-right">Mínimo</th>
              <th className="px-3 py-2 text-right">Por caixa</th>
              <th className="px-3 py-2">Medida</th>
              <th className="px-3 py-2">Caixas</th>
              <th className="px-3 py-2 text-right">Estoque</th>
              <th className="px-3 py-2 text-right">Falta</th>
              <th className="px-4 py-2">Cobertura</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <GroupRows key={group.sectorName} group={group} values={values} setValues={setValues} units={units} changeUnit={changeUnit} canEdit={canEdit} />
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}

function GroupRows({
  group,
  values,
  setValues,
  units,
  changeUnit,
  canEdit,
}: {
  group: { sectorName: string; rows: CountRow[] };
  values: Record<string, string>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  units: Record<string, string>;
  changeUnit: (productId: string, unit: string) => void;
  canEdit: boolean;
}) {
  return (
    <>
      <tr className="bg-neutral-50/70">
        <td colSpan={8} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
          {group.sectorName}
        </td>
      </tr>
      {group.rows.map((row) => {
        const raw = values[row.id] ?? "";
        const hasValue = raw.trim() !== "" && Number.isFinite(Number(raw));
        const stock = hasValue ? stockUnits(Number(raw), row.unitsPerBox) : null;
        const cov = stock === null ? null : coverageOf(stock, row.min);
        return (
          <tr key={row.id} className="border-t border-neutral-100">
            <td className="px-4 py-1.5 text-neutral-800">{row.name}</td>
            <td className="px-3 py-1.5 text-right tabular-nums text-neutral-500">{fmt(row.min)}</td>
            <td className="px-3 py-1.5 text-right tabular-nums text-neutral-400">{fmt(row.unitsPerBox)}</td>
            <td className="px-3 py-1.5">
              {canEdit ? (
                <select
                  value={units[row.id] ?? row.unit}
                  onChange={(ev) => changeUnit(row.id, ev.target.value)}
                  aria-label={`Medida de ${row.name}`}
                  className="rounded-md border border-neutral-200 bg-white px-1.5 py-1 text-base text-neutral-700 sm:text-xs"
                >
                  {unitOptionsFor(row.unit).map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.value}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-neutral-500">{units[row.id] ?? row.unit}</span>
              )}
            </td>
            <td className="px-3 py-1.5">
              <input
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={raw}
                onChange={(e) => setValues((prev) => ({ ...prev, [row.id]: e.target.value }))}
                className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-right text-base tabular-nums focus:border-orange-500 sm:text-sm focus:outline-none"
              />
            </td>
            <td className="px-3 py-1.5 text-right font-medium tabular-nums text-neutral-900">
              {stock === null ? "—" : `${fmt(stock)} ${units[row.id] ?? row.unit}`}
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums text-neutral-500">
              {cov && cov.missing > 0 ? fmt(cov.missing) : "—"}
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
