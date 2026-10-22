import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { formatBrDate, weekdayOfISODate } from "@/lib/dates";
import { WEEKDAY_LABELS } from "@/lib/format/labels";
import { loadHortifrutiDemand } from "@/lib/hortifruti/load";
import { ScheduleItemLink } from "@/components/compras/schedule-item-link";

const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n);
const shortDay = (iso: string) => `${WEEKDAY_LABELS[weekdayOfISODate(iso)].slice(0, 3)} ${formatBrDate(iso).slice(0, 5)}`;

export default async function DemandaHortifrutPage() {
  await requireUser();
  const supabase = await createClient();
  const view = await loadHortifrutiDemand(supabase);

  const needed = view.materials.filter((m) => m.total > 0);
  const columns = view.days.filter((d) => needed.some((m) => (m.byDate[d] ?? 0) > 0));
  const productionsByDate = new Map<string, typeof view.productions>();
  for (const p of view.productions) productionsByDate.set(p.date, [...(productionsByDate.get(p.date) ?? []), p]);

  return (
    <div className="space-y-5">
      <p className="text-sm text-neutral-500">
        Quanto de hortifrut as produções dos <b>próximos 10 dias</b> ({formatBrDate(view.days[0])} a{" "}
        {formatBrDate(view.days[view.days.length - 1])}) vão precisar. A conta usa o cronograma de produção (cada
        &ldquo;Produzir&rdquo; vale uma receita, &ldquo;2x Produzir&rdquo; vale duas) e a quantidade de cada matéria-prima
        na ficha técnica do item.
      </p>

      {view.emptyWeeks.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          O cronograma ainda está vazio na semana de {view.emptyWeeks.map(formatBrDate).join(", ")}. Preencha o
          cronograma para a demanda considerar essas produções.
        </p>
      )}

      {view.unlinked.length > 0 && (
        <section className="space-y-2 rounded-lg border border-orange-200 bg-orange-50/50 p-4">
          <h2 className="text-sm font-semibold text-neutral-900">Produções sem ficha técnica vinculada</h2>
          <p className="text-xs text-neutral-600">
            Estes itens do cronograma não foram reconhecidos pelo nome. Escolha a ficha técnica de cada um para a
            demanda entrar na conta.
          </p>
          <ul className="space-y-2.5">
            {view.unlinked.map((item) => (
              <li key={item.scheduleItemId} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-neutral-800">
                  <b>{item.name}</b>
                  <span className="ml-2 text-xs text-neutral-500">{item.dates.map((d) => shortDay(d)).join(" · ")}</span>
                </span>
                <ScheduleItemLink scheduleItemId={item.scheduleItemId} options={view.sheetOptions} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.unitMismatches.length > 0 && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          Unidade diferente da cadastrada em:{" "}
          {view.unitMismatches.map((m) => `${m.material} (${m.name}: ${m.from} em vez de ${m.to})`).join("; ")}. Essas linhas
          não entraram na conta.
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-neutral-900">Hortifrut necessário</h2>
        {needed.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nenhuma produção dos próximos 10 dias usa hortifrut, ou as fichas técnicas ainda não têm essas matérias-primas.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Matéria-prima</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  {columns.map((d) => (
                    <th key={d} className="px-3 py-2 text-right whitespace-nowrap">
                      {shortDay(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {needed.map((m) => (
                  <tr key={m.id} className="border-t border-neutral-100">
                    <td className="px-4 py-1.5 font-medium text-neutral-800">{m.name.replace(/^MP\s+/i, "")}</td>
                    <td className="px-3 py-1.5 text-right font-bold tabular-nums text-neutral-900">
                      {fmt(m.total)} {m.unit}
                    </td>
                    {columns.map((d) => (
                      <td key={d} className="px-3 py-1.5 text-right tabular-nums text-neutral-500">
                        {m.byDate[d] ? fmt(m.byDate[d]) : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-neutral-900">Produções consideradas</h2>
        {view.productions.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma produção marcada no cronograma para os próximos 10 dias.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            {[...productionsByDate.entries()].map(([date, items]) => (
              <div key={date} className="border-t border-neutral-100 first:border-t-0">
                <p className="bg-neutral-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {WEEKDAY_LABELS[weekdayOfISODate(date)]}, {formatBrDate(date)}
                </p>
                <ul>
                  {items.map((p) => (
                    <li key={`${p.scheduleItemId}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-sm">
                      <span className="text-neutral-800">
                        {p.name}
                        {p.batches > 1 && <span className="ml-1.5 text-xs font-semibold text-orange-700">{p.batches}x</span>}
                      </span>
                      {p.sheetName ? (
                        <span className="text-xs text-neutral-400">
                          ficha: {p.sheetName}
                          {p.linkedBy === "auto" ? "" : " (vinculada)"}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-orange-700">sem ficha técnica vinculada</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
