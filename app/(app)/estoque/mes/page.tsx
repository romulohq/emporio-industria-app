import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EstoqueTabs } from "@/components/stock/estoque-tabs";
import { getOsorioCatalog } from "@/lib/stock/osorio";
import { MonthSectorRows, type MonthCell } from "@/components/stock/month-sector-rows";
import { coverageOf } from "@/lib/stock/coverage";
import { fortalezaDateISO, weekdayOfISODate } from "@/lib/dates";
import { WEEKDAY_SHORT_LABELS } from "@/lib/format/labels";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const CELL: Record<string, string> = {
  ok: "bg-green-50 text-green-700",
  warn: "bg-amber-50 text-amber-700",
  low: "bg-red-50 text-red-600",
  none: "text-neutral-700",
};

const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n);

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function VisaoDoMesPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const month = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : fortalezaDateISO().slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);
  const firstDay = `${month}-01`;
  const lastDay = `${month}-${String(new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()).padStart(2, "0")}`;

  const supabase = await createClient();
  const { sectors, products } = await getOsorioCatalog(supabase);

  // a month holds more than the API's 1000-row page, so read it in pages
  const stockByProductDate = new Map<string, number>();
  const dates = new Set<string>();
  for (let from = 0; products.length; from += 1000) {
    const { data: page } = await supabase
      .from("stock_counts")
      .select("product_id, count_date, stock_units")
      .gte("count_date", firstDay)
      .lte("count_date", lastDay)
      .order("count_date")
      .order("product_id")
      .range(from, from + 999);
    for (const row of page ?? []) {
      stockByProductDate.set(`${row.product_id}:${row.count_date}`, Number(row.stock_units));
      dates.add(row.count_date as string);
    }
    if (!page || page.length < 1000) break;
  }
  const dateList = [...dates].sort();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Estoque</h1>
        <p className="text-sm text-neutral-500">Fábrica Osório de Paiva</p>
      </div>

      <EstoqueTabs />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link
            href={`/estoque/mes?mes=${shiftMonth(month, -1)}`}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-36 text-center text-sm font-semibold text-neutral-900">
            {MONTH_NAMES[monthNumber - 1]} {year}
          </span>
          <Link
            href={`/estoque/mes?mes=${shiftMonth(month, 1)}`}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" />no mínimo ou acima</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />50% a 99%</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />abaixo de 50%</span>
        </div>
      </div>

      {dateList.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma contagem neste mês ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 text-xs font-semibold uppercase">Produto</th>
                <th className="px-2 py-2 text-right font-semibold uppercase">Mín.</th>
                {dateList.map((d) => (
                  <th key={d} className="px-2 py-2 text-center font-semibold">
                    <div>{d.slice(8)}</div>
                    <div className="text-[10px] font-normal text-neutral-400">
                      {WEEKDAY_SHORT_LABELS[weekdayOfISODate(d)]}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sectors.map((sector) => {
                const rows = products.filter((p) => p.sector_id === sector.id);
                if (rows.length === 0) return null;
                return (
                  <MonthSectorRows
                    key={sector.id}
                    name={sector.name}
                    colSpan={dateList.length + 2}
                    rows={rows.map((p) => {
                      const min = Number(p.min_quantity);
                      return {
                        id: p.id,
                        name: p.name,
                        min: fmt(min),
                        cells: dateList.map((d): MonthCell => {
                          const stock = stockByProductDate.get(`${p.id}:${d}`);
                          if (stock === undefined) return null;
                          const cov = coverageOf(stock, min);
                          return {
                            text: fmt(stock),
                            title: cov.ratio === null ? undefined : `${Math.round(cov.ratio * 100)}% do mínimo`,
                            className: CELL[cov.level],
                          };
                        }),
                      };
                    })}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
