"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveHortifrutiCount } from "@/app/(app)/compras/hortifrut/actions";

export type CountRow = { id: string; name: string; unit: string; quantity: number | null; lastDate: string | null; lastQuantity: number | null };

const toNumber = (v: string) => Number(v.trim().replace(",", "."));
const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n);
const brDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** The day's hortifruti stock: type a quantity and it is saved on its own a moment later. */
export function HortifrutCountForm({
  date,
  rows,
  canEdit,
}: {
  date: string;
  rows: CountRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const initial = Object.fromEntries(rows.map((r) => [r.id, r.quantity === null ? "" : String(r.quantity).replace(".", ",")]));
  const [values, setValues] = useState<Record<string, string>>(initial);
  const valuesRef = useRef(initial);
  const savedRef = useRef<Record<string, number>>(
    Object.fromEntries(rows.filter((r) => r.quantity !== null).map((r) => [r.id, r.quantity as number]))
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const pending = () =>
    Object.entries(valuesRef.current)
      .map(([id, v]) => ({ raw_material_id: id, text: v.trim(), quantity: toNumber(v) }))
      .filter((e) => e.text !== "" && Number.isFinite(e.quantity) && e.quantity >= 0 && savedRef.current[e.raw_material_id] !== e.quantity)
      .map(({ raw_material_id, quantity }) => ({ raw_material_id, quantity }));

  async function flush() {
    if (busy.current) return;
    busy.current = true;
    setStatus("saving");
    try {
      for (let batch = pending(); batch.length > 0; batch = pending()) {
        const result = await saveHortifrutiCount({ date, entries: batch });
        if (result.error) {
          setError(result.error);
          setStatus("error");
          return;
        }
        for (const e of batch) savedRef.current[e.raw_material_id] = e.quantity;
      }
      setError(null);
      setStatus("saved");
    } catch {
      setError("Sem conexão: a contagem será salva na próxima alteração.");
      setStatus("error");
    } finally {
      busy.current = false;
    }
  }

  function change(id: string, value: string) {
    valuesRef.current = { ...valuesRef.current, [id]: value };
    setValues(valuesRef.current);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 700);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          Data da contagem
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && router.push(`/compras/hortifrut?data=${e.target.value}`)}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm text-neutral-900"
          />
        </label>
        <span className="text-xs">
          {status === "saving" && <span className="text-neutral-500">Salvando automaticamente...</span>}
          {status === "saved" && <span className="text-green-700">Contagem salva automaticamente.</span>}
          {status === "error" && error && <span className="text-red-600">{error}</span>}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Matéria-prima</th>
              <th className="px-3 py-2">Quantidade em estoque</th>
              <th className="px-3 py-2">Unidade</th>
              <th className="px-4 py-2">Última contagem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className="border-t border-neutral-100">
                <td className="px-4 py-1.5 font-medium text-neutral-800">{row.name.replace(/^MP\s+/i, "")}</td>
                <td className="px-3 py-1.5">
                  <input
                    value={values[row.id] ?? ""}
                    onChange={(e) => change(row.id, e.target.value)}
                    inputMode="decimal"
                    disabled={!canEdit}
                    aria-label={`Quantidade de ${row.name}`}
                    className="w-28 rounded-md border border-neutral-300 px-2 py-1 text-right text-base tabular-nums focus:border-orange-500 focus:outline-none disabled:bg-neutral-50 sm:text-sm"
                    data-row={index}
                  />
                </td>
                <td className="px-3 py-1.5 text-neutral-500">{row.unit}</td>
                <td className="px-4 py-1.5 text-xs text-neutral-400">
                  {row.lastDate ? `${fmt(row.lastQuantity ?? 0)} ${row.unit} em ${brDate(row.lastDate)}` : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                  Nenhuma matéria-prima da categoria hortifrut cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
