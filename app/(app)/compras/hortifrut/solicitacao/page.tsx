import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { formatBrDate } from "@/lib/dates";
import { loadHortifrutiDemand, loadLatestCounts } from "@/lib/hortifruti/load";
import { quantityToOrder } from "@/lib/hortifruti/demand";
import { OrderActions } from "@/components/compras/order-actions";

const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n);

export default async function SolicitacaoHortifrutPage() {
  await requireUser();
  const supabase = await createClient();
  const view = await loadHortifrutiDemand(supabase);
  const latest = await loadLatestCounts(supabase, view.today);

  const rows = view.materials
    .filter((m) => m.total > 0)
    .map((m) => {
      const count = latest.get(m.id);
      const stock = count?.quantity ?? 0;
      return {
        ...m,
        label: m.name.replace(/^MP\s+/i, ""),
        stock,
        countDate: count?.date ?? null,
        order: quantityToOrder(m.total, stock),
      };
    });
  const toOrder = rows.filter((r) => r.order > 0);
  const covered = rows.filter((r) => r.order === 0);
  const staleCounts = rows.filter((r) => r.countDate !== null && r.countDate < view.today).length;
  const neverCounted = rows.filter((r) => r.countDate === null).map((r) => r.label);

  const orderText = [
    `Pedido de hortifrut — ${formatBrDate(view.today)}`,
    `(produção de ${formatBrDate(view.days[0])} a ${formatBrDate(view.days[view.days.length - 1])})`,
    "",
    ...toOrder.map((r) => `${r.label}: ${fmt(r.order)} ${r.unit}`),
  ].join("\n");

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <p className="text-sm text-neutral-500">
          O que pedir ao fornecedor de hortifrut: a necessidade das produções dos próximos 10 dias (
          {formatBrDate(view.days[0])} a {formatBrDate(view.days[view.days.length - 1])}) menos o estoque da última
          contagem de cada item.
        </p>
      </div>

      {(view.unlinked.length > 0 || view.emptyWeeks.length > 0) && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 print:hidden">
          A demanda está incompleta
          {view.unlinked.length > 0 ? `: ${view.unlinked.length} produção(ões) sem ficha técnica vinculada` : ""}
          {view.emptyWeeks.length > 0 ? `${view.unlinked.length > 0 ? " e" : ":"} cronograma vazio em ${view.emptyWeeks.length} semana(s)` : ""}
          . Veja a aba Demanda semanal.
        </p>
      )}
      {neverCounted.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 print:hidden">
          Sem nenhuma contagem de estoque (contado como zero): {neverCounted.join(", ")}.
        </p>
      )}
      {staleCounts > 0 && (
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs text-neutral-600 print:hidden">
          {staleCounts} item(ns) usam uma contagem de dias anteriores. Faça a contagem de hoje para o pedido refletir o
          estoque atual.
        </p>
      )}

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">Pedido ao fornecedor</h2>
          {toOrder.length > 0 && <OrderActions text={orderText} />}
        </div>
        {toOrder.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {rows.length === 0
              ? "Nenhuma necessidade de hortifrut nos próximos 10 dias."
              : "O estoque contado cobre toda a necessidade dos próximos 10 dias. Nada a pedir."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Hortifrut</th>
                  <th className="px-3 py-2 text-right">Necessário</th>
                  <th className="px-3 py-2 text-right">Em estoque</th>
                  <th className="px-4 py-2 text-right">Pedir</th>
                </tr>
              </thead>
              <tbody>
                {toOrder.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-100">
                    <td className="px-4 py-1.5 font-medium text-neutral-800">{r.label}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-neutral-500">
                      {fmt(r.total)} {r.unit}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-neutral-500">
                      {fmt(r.stock)} {r.unit}
                      {r.countDate && <span className="ml-1 text-[11px] text-neutral-400">({formatBrDate(r.countDate).slice(0, 5)})</span>}
                    </td>
                    <td className="px-4 py-1.5 text-right text-base font-bold tabular-nums text-orange-700">
                      {fmt(r.order)} {r.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {covered.length > 0 && (
        <section className="space-y-2 print:hidden">
          <h2 className="text-sm font-semibold text-neutral-900">Já cobertos pelo estoque</h2>
          <ul className="flex flex-wrap gap-2">
            {covered.map((r) => (
              <li key={r.id} className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600">
                {r.label} · precisa {fmt(r.total)} {r.unit}, tem {fmt(r.stock)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
