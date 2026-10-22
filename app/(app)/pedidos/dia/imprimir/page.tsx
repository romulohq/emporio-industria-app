import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-session";
import { PrintButton } from "@/components/orders/print-button";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { sectorPrintCss, sectorPrintLayout } from "@/lib/orders/print-fit";
import { weekdayOfISODate, formatBrDate } from "@/lib/dates";
import { WEEKDAY_LABELS, formatDateTime, formatQuantity } from "@/lib/format/labels";
import type {
  Product,
  ProductionOrder,
  ProductionOrderContribution,
  Sector,
  Store,
} from "@/lib/types/database.types";

export default async function ImprimirOrdemDoDiaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireUser();
  const { date } = await searchParams;
  const supabase = await createClient();

  if (!date) {
    return <p className="p-6 text-sm text-neutral-500">Informe a data (?date=AAAA-MM-DD) na URL.</p>;
  }

  const { data: orders } = await supabase
    .from("production_orders")
    .select("*")
    .eq("source", "auto_route")
    .eq("delivery_date", date)
    .in("status", ["pending", "in_progress", "completed"]);

  const ordersList = (orders ?? []) as ProductionOrder[];
  const orderIds = ordersList.map((o) => o.id);

  const [{ data: sectors }, { data: products }, contributions] = await Promise.all([
    supabase.from("sectors").select("*"),
    supabase.from("products").select("*"),
    orderIds.length
      ? fetchAll<ProductionOrderContribution>((from, to) =>
          supabase
            .from("production_order_contributions")
            .select("*")
            .in("order_id", orderIds)
            .order("order_id")
            .order("store_id")
            .range(from, to)
        )
      : Promise.resolve([] as ProductionOrderContribution[]),
  ]);

  const storeIds = [...new Set((contributions ?? []).map((c) => c.store_id))];
  const { data: stores } = storeIds.length
    ? await supabase.from("stores").select("*").in("id", storeIds)
    : { data: [] as Store[] };

  const sectorsById = Object.fromEntries(((sectors ?? []) as Sector[]).map((s) => [s.id, s]));
  const productsById = Object.fromEntries(((products ?? []) as Product[]).map((p) => [p.id, p]));
  const storesById = Object.fromEntries(((stores ?? []) as Store[]).map((s) => [s.id, s]));

  const contributionsByOrder = new Map<string, ProductionOrderContribution[]>();
  for (const c of (contributions ?? []) as ProductionOrderContribution[]) {
    const list = contributionsByOrder.get(c.order_id) ?? [];
    list.push(c);
    contributionsByOrder.set(c.order_id, list);
  }

  // sector -> { stores (sorted), orders (sorted by product name) }
  const bySector = new Map<string, ProductionOrder[]>();
  for (const order of ordersList) {
    const list = bySector.get(order.sector_id) ?? [];
    list.push(order);
    bySector.set(order.sector_id, list);
  }

  const generatedAt = ordersList.find((o) => o.generated_at)?.generated_at ?? null;

  // printing: A4 landscape, one sector per page, each sector squeezed to fit its page
  const sectorEntries = [...bySector.entries()].map(([sectorId, sectorOrders], index) => {
    const sortedOrders = [...sectorOrders].sort((a, b) =>
      (productsById[a.product_id]?.name ?? "").localeCompare(productsById[b.product_id]?.name ?? "")
    );
    const sectorStoreIds = [
      ...new Set(sortedOrders.flatMap((o) => (contributionsByOrder.get(o.id) ?? []).map((c) => c.store_id))),
    ].sort((a, b) => (storesById[a]?.name ?? "").localeCompare(storesById[b]?.name ?? ""));
    const longestStore = Math.max(0, ...sectorStoreIds.map((id) => storesById[id]?.name.length ?? 0));
    const scope = `sector-print-${index}`;
    const layout = sectorPrintLayout(sortedOrders.length, sectorStoreIds.length, longestStore);
    return { sectorId, sortedOrders, sectorStoreIds, scope, layout, index };
  });
  const printCss = `@media print { @page { size: A4 landscape; margin: 8mm; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }${sectorEntries
    .map((entry) => sectorPrintCss(entry.scope, entry.layout))
    .join("")}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 print:max-w-none print:space-y-3 print:p-0">
      <style>{printCss}</style>
      <div className="flex items-center justify-between print:hidden">
        <Link href="/pedidos/dia" className="text-sm font-medium text-orange-700 hover:text-orange-800">
          ← Voltar
        </Link>
        <PrintButton />
      </div>

      <header className="space-y-1 border-b-2 border-orange-600 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 text-xs font-extrabold text-white">
            EP
          </span>
          <span className="text-sm font-extrabold text-neutral-900">Empório do Pão — Unidade Rui Barbosa</span>
        </div>
        <h1 className="text-2xl font-bold text-neutral-900">
          Ordem de produção — {WEEKDAY_LABELS[weekdayOfISODate(date)]}, {formatBrDate(date)}
        </h1>
        {generatedAt && (
          <p className="text-xs text-neutral-500">Gerado em {formatDateTime(generatedAt)}</p>
        )}
      </header>

      {bySector.size === 0 && (
        <p className="text-sm text-neutral-500">Nenhum pedido para esta data.</p>
      )}

      {sectorEntries.map(({ sectorId, sortedOrders, sectorStoreIds, scope, index }) => {
        return (
          <section
            key={sectorId}
            className={`${scope} space-y-2 ${index > 0 ? "print:[break-before:page]" : ""}`}
          >
            <h2 className="flex items-baseline gap-3 text-lg font-bold text-orange-700 print:text-base">
              {sectorsById[sectorId]?.name ?? "—"}
              {index > 0 && (
                <span className="hidden text-xs font-medium text-neutral-500 print:inline">
                  Ordem de produção — {WEEKDAY_LABELS[weekdayOfISODate(date)]}, {formatBrDate(date)}
                </span>
              )}
            </h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-orange-50">
                  <th className="border border-orange-100 px-2 py-1.5 text-left font-semibold text-neutral-900">
                    Produto
                  </th>
                  {sectorStoreIds.map((storeId) => (
                    <th
                      key={storeId}
                      className="border border-orange-100 px-2 py-1.5 text-center font-semibold text-neutral-900"
                    >
                      <span className="store-name">{storesById[storeId]?.name}</span>
                    </th>
                  ))}
                  <th className="border border-orange-100 bg-orange-100 px-2 py-1.5 text-center font-bold text-neutral-900">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedOrders.map((order) => {
                  const product = productsById[order.product_id];
                  const contribByStore = new Map(
                    (contributionsByOrder.get(order.id) ?? []).map((c) => [c.store_id, c.quantity])
                  );
                  return (
                    <tr key={order.id} className="even:bg-neutral-50">
                      <td className="border border-neutral-200 px-2 py-1 font-medium text-neutral-900">
                        {product?.name ?? "—"}
                      </td>
                      {sectorStoreIds.map((storeId) => (
                        <td key={storeId} className="border border-neutral-200 px-2 py-1 text-center text-neutral-600">
                          {contribByStore.get(storeId) ?? "—"}
                        </td>
                      ))}
                      <td className="border border-neutral-200 bg-orange-50 px-2 py-1 text-center font-bold text-neutral-900">
                        {product ? formatQuantity(order.quantity, product.unit) : order.quantity}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
