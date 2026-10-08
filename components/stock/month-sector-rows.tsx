"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

export type MonthCell = { text: string; title?: string; className: string } | null;
export type MonthRow = { id: string; name: string; min: string; cells: MonthCell[] };

/** One sector of the month grid; starts expanded and folds when its title is clicked. */
export function MonthSectorRows({ name, colSpan, rows }: { name: string; colSpan: number; rows: MonthRow[] }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <>
      <tr className="bg-neutral-50/70">
        <td colSpan={colSpan} className="p-0">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!collapsed}
            className="sticky left-0 flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 hover:text-neutral-600"
          >
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${collapsed ? "" : "rotate-90"}`} />
            {name}
            {collapsed && <span className="font-normal normal-case tracking-normal">· {rows.length} produtos</span>}
          </button>
        </td>
      </tr>
      {!collapsed &&
        rows.map((row) => (
          <tr key={row.id} className="border-t border-neutral-100">
            <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1 text-neutral-800">{row.name}</td>
            <td className="px-2 py-1 text-right tabular-nums text-neutral-400">{row.min}</td>
            {row.cells.map((cell, i) =>
              cell === null ? (
                <td key={i} className="px-2 py-1 text-center text-neutral-200">
                  ·
                </td>
              ) : (
                <td key={i} title={cell.title} className={`px-2 py-1 text-right tabular-nums ${cell.className}`}>
                  {cell.text}
                </td>
              )
            )}
          </tr>
        ))}
    </>
  );
}
