"use client";

import { useEffect, useState } from "react";
import { coverageOf, type CoverageLevel } from "@/lib/stock/coverage";
import { formatBrDate } from "@/lib/dates";

export type PrintRow = { id: string; name: string; unit: string; stock: number | null; min: number };
export type PrintGroup = { sectorName: string; rows: PrintRow[] };

const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n);

// solid band per sector, as in the production schedule
const SECTOR_BAND: Record<string, string> = {
  Salgados: "bg-orange-600",
  Folheados: "bg-amber-500",
  "Pães": "bg-stone-600",
  Cozinha: "bg-emerald-700",
};

const BAR: Record<CoverageLevel, string> = {
  ok: "bg-green-500",
  warn: "bg-amber-400",
  low: "bg-red-500",
  none: "bg-neutral-300",
};
const TEXT: Record<CoverageLevel, string> = {
  ok: "text-green-700",
  warn: "text-amber-700",
  low: "text-red-600",
  none: "text-neutral-400",
};
const TINT: Record<CoverageLevel, string> = {
  ok: "bg-green-50",
  warn: "bg-amber-50",
  low: "bg-red-50",
  none: "",
};

/**
 * One-page, colour-coded printout of every stock of the count (shown only when printing).
 * Quantities are the ones on screen, saved or not, so it prints exactly what is being looked at.
 */
export function StockPrintReport({ date, groups }: { date: string; groups: PrintGroup[] }) {
  const [printedAt, setPrintedAt] = useState("");

  useEffect(() => {
    const stamp = () =>
      setPrintedAt(
        new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short" }).format(
          new Date()
        )
      );
    window.addEventListener("beforeprint", stamp);
    return () => window.removeEventListener("beforeprint", stamp);
  }, []);

  return (
    <div className="hidden print:block">
      <style>{"@media print { @page { size: A4 portrait; margin: 8mm; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }"}</style>

      <div className="mb-3 flex items-end justify-between border-b-2 border-orange-600 pb-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-600 text-xs font-extrabold text-white">
            EP
          </span>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-orange-600">
              Empório do Pão · Fábrica Osório de Paiva
            </p>
            <p className="text-lg font-black leading-tight text-neutral-900">Estoque da câmara</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-neutral-500">Contagem de</p>
          <p className="text-base font-extrabold leading-tight text-neutral-900">{formatBrDate(date)}</p>
        </div>
      </div>

      <div className="columns-2 gap-5">
        {groups.map((group) => (
          <section key={group.sectorName} className="mb-2.5">
            <h2
              className={`break-after-avoid rounded-sm px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white ${
                SECTOR_BAND[group.sectorName] ?? "bg-neutral-600"
              }`}
            >
              {group.sectorName}
            </h2>
            <table className="w-full border-collapse text-[9px]">
              <tbody>
                {group.rows.map((row) => {
                  const cov = row.stock === null ? null : coverageOf(row.stock, row.min);
                  const level: CoverageLevel = cov?.level ?? "none";
                  return (
                    <tr key={row.id} className={`break-inside-avoid border-b border-neutral-200 ${TINT[level]}`}>
                      <td className="py-px pl-1 pr-1.5 font-semibold text-neutral-900">{row.name}</td>
                      <td className="whitespace-nowrap py-px pr-1.5 text-right font-bold tabular-nums text-neutral-900">
                        {row.stock === null ? "—" : `${fmt(row.stock)} ${row.unit}`}
                      </td>
                      <td className="w-24 py-px pr-1">
                        <div className="flex items-center gap-1">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200">
                            <div
                              className={`h-full rounded-full ${BAR[level]}`}
                              style={{ width: `${cov?.ratio == null ? 0 : Math.max(0, Math.min(1, cov.ratio)) * 100}%` }}
                            />
                          </div>
                          <span className={`w-7 shrink-0 text-right font-bold tabular-nums ${TEXT[level]}`}>
                            {cov?.ratio == null ? "—" : `${Math.round(cov.ratio * 100)}%`}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </div>

      <div className="mt-1 flex items-center justify-between text-[8px] text-neutral-500">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold uppercase tracking-wide">Abastecimento</span>
          <span className="rounded bg-green-500 px-1.5 py-0.5 font-semibold text-white">100% ou mais</span>
          <span className="rounded bg-amber-400 px-1.5 py-0.5 font-semibold text-amber-950">50% a 99%</span>
          <span className="rounded bg-red-500 px-1.5 py-0.5 font-semibold text-white">abaixo de 50%</span>
          <span className="rounded bg-neutral-300 px-1.5 py-0.5 font-semibold text-neutral-700">sem contagem</span>
        </div>
        <span>Impresso em {printedAt}</span>
      </div>
    </div>
  );
}
