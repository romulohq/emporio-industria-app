import type { CoverageLevel } from "@/lib/stock/coverage";

const COLORS: Record<CoverageLevel, { bar: string; text: string }> = {
  ok: { bar: "bg-green-500", text: "text-green-700" },
  warn: { bar: "bg-amber-400", text: "text-amber-700" },
  low: { bar: "bg-red-500", text: "text-red-600" },
  none: { bar: "bg-neutral-300", text: "text-neutral-400" },
};

/** The sheet's "Abastecimento" bar: how much of the minimum is covered by the current stock. */
export function CoverageBar({ ratio, level }: { ratio: number | null; level: CoverageLevel }) {
  const width = ratio === null ? 0 : Math.max(0, Math.min(1, ratio)) * 100;
  const color = COLORS[level];
  return (
    <div className="flex items-center gap-3">
      <div className="h-3 min-w-36 flex-1 overflow-hidden rounded-full bg-neutral-100">
        <div className={`h-full rounded-full ${color.bar}`} style={{ width: `${width}%` }} />
      </div>
      <span className={`w-11 shrink-0 text-right text-xs font-semibold tabular-nums ${color.text}`}>
        {ratio === null ? "—" : `${Math.round(ratio * 100)}%`}
      </span>
    </div>
  );
}
