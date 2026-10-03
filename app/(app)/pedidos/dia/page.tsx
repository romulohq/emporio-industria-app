import Link from "next/link";
import { Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-session";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/orders/status-badge";
import { PedidosTabs } from "@/components/orders/pedidos-tabs";
import { ContributionMenu, type ContributionHistoryItem } from "@/components/orders/contribution-menu";
import { LateReportGroupCard } from "@/components/orders/late-report-group-card";
import { LateReportsPopup } from "@/components/orders/late-reports-popup";
import { generateTodayProductionOrders } from "./actions";
import { getUndecidedLateReports, groupLateReports } from "@/lib/orders/late-reports";
import { deliveryDatesInProduction, productionDateForDelivery } from "@/lib/delivery-schedule";
import { weekdayOfISODate, formatBrDate, fortalezaDateISO, dateToFortalezaISO } from "@/lib/dates";
import { WEEKDAY_LABELS, formatQuantity } from "@/lib/format/labels";
import type {
  Product,
  ProductionOrder,
  ProductionOrderContribution,
  Sector,
  Store,
  StoreDeliveryDay,
  StoreStockReport,
} from "@/lib/types/database.types";

export default async function OrdensPorDiaPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const todayISO = fortalezaDateISO();

  const [{ data: orders }, { data: sectors }, { data: products }] = await Promise.all([
    supabase
      .from("production_orders")
      .select("*")
      .eq("source", "auto_route")
      .in("status", ["pending", "in_progress"])
      .gt("delivery_date", todayISO)
      .order("delivery_date", { ascending: true }),
    supabase.from("sectors").select("*"),
    supabase.from("products").select("*"),
  ]);

  const orderIds = (orders ?? []).map((o) => o.id);
  const { data: contributions } = orderIds.length
    ? await supabase.from("production_order_contributions").select("*").in("order_id", orderIds)
    : { data: [] as ProductionOrderContribution[] };

  // contributions built from an earlier cycle's report (store didn't send for this delivery)
  const contributionReportIds = [...new Set((contributions ?? []).map((c) => c.report_id).filter(Boolean))] as string[];
  const { data: contributionReports } = contributionReportIds.length
    ? await supabase.from("store_stock_reports").select("id, delivery_date, created_at").in("id", contributionReportIds)
    : { data: [] as Pick<StoreStockReport, "id" | "delivery_date" | "created_at">[] };
  const reportById = new Map(
    ((contributionReports ?? []) as Pick<StoreStockReport, "id" | "delivery_date" | "created_at">[]).map((r) => [r.id, r])
  );

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

  // admins get a per-store report history so they can pick an older one manually
  const historyByStoreProduct = new Map<string, ContributionHistoryItem[]>();
  if (profile.is_admin && storeIds.length) {
    const productIds = [...new Set((orders ?? []).map((o) => o.product_id))];
    const { data: reports } = await supabase
      .from("store_stock_reports")
      .select("*")
      .in("store_id", storeIds)
      .in("product_id", productIds)
      .order("created_at", { ascending: false })
      .limit(1000);

    for (const report of (reports ?? []) as StoreStockReport[]) {
      const key = `${report.store_id}:${report.product_id}`;
      const list = historyByStoreProduct.get(key) ?? [];
      if (list.length < 15) {
        list.push({ reportId: report.id, createdAt: report.created_at, quantityReported: report.quantity_reported });
        historyByStoreProduct.set(key, list);
      }
    }
  }

  // admins get a grouped inbox of late reports for stragglers that missed an already-generated order
  const lateGroups = profile.is_admin ? groupLateReports(await getUndecidedLateReports()) : [];

  // delivery_date -> sector -> orders
  const tree = new Map<string, Map<string, ProductionOrder[]>>();
  for (const order of (orders ?? []) as ProductionOrder[]) {
    if (!order.delivery_date) continue;
    const bySector = tree.get(order.delivery_date) ?? new Map<string, ProductionOrder[]>();
    const list = bySector.get(order.sector_id) ?? [];
    list.push(order);
    bySector.set(order.sector_id, list);
    tree.set(order.delivery_date, bySector);
  }

  const dateEntries = [...tree.entries()].sort(([a], [b]) => (a < b ? -1 : 1));

  // deliveries whose production day has started should already have an order — check them for
  // missing stores even when nothing was generated yet, so a day with zero reports isn't
  // simply invisible just because there's no order to hang the warning on
  const inProductionDates = deliveryDatesInProduction(todayISO);
  const orderDates = dateEntries.map(([d]) => d);
  const checkDates = [...new Set([...orderDates, ...inProductionDates])];
  const weekdaysNeeded = [...new Set(checkDates.map((d) => weekdayOfISODate(d)))];

  const [{ data: allDeliveryDays }, { data: cycleReports }] = await Promise.all([
    weekdaysNeeded.length
      ? supabase.from("store_delivery_days").select("*").in("weekday", weekdaysNeeded)
      : Promise.resolve({ data: [] as StoreDeliveryDay[] }),
    checkDates.length
      ? supabase.from("store_stock_reports").select("store_id, delivery_date").in("delivery_date", checkDates)
      : Promise.resolve({ data: [] as { store_id: string; delivery_date: string | null }[] }),
  ]);

  const scheduledStoreIdsByDate = new Map<string, Set<string>>();
  for (const date of checkDates) {
    const weekday = weekdayOfISODate(date);
    const ids = new Set(
      ((allDeliveryDays ?? []) as StoreDeliveryDay[]).filter((d) => d.weekday === weekday).map((d) => d.store_id)
    );
    scheduledStoreIdsByDate.set(date, ids);
  }

  const reportedStoreIdsByDate = new Map<string, Set<string>>();
  for (const r of (cycleReports ?? []) as { store_id: string; delivery_date: string | null }[]) {
    if (!r.delivery_date) continue;
    const set = reportedStoreIdsByDate.get(r.delivery_date) ?? new Set<string>();
    set.add(r.store_id);
    reportedStoreIdsByDate.set(r.delivery_date, set);
  }

  const allScheduledStoreIds = new Set<string>();
  for (const ids of scheduledStoreIdsByDate.values()) for (const id of ids) allScheduledStoreIds.add(id);
  const { data: allStoresForMissing } = allScheduledStoreIds.size
    ? await supabase.from("stores").select("id, name").in("id", [...allScheduledStoreIds])
    : { data: [] as { id: string; name: string }[] };
  const storeNameById = Object.fromEntries((allStoresForMissing ?? []).map((s) => [s.id, s.name]));

  const missingByDate = new Map<string, string[]>();
  for (const date of checkDates) {
    const scheduled = scheduledStoreIdsByDate.get(date) ?? new Set<string>();
    const reported = reportedStoreIdsByDate.get(date) ?? new Set<string>();
    const missing = [...scheduled].filter((id) => !reported.has(id)).map((id) => storeNameById[id] ?? "?");
    if (missing.length) missingByDate.set(date, missing.sort());
  }

  // full set of stores this cycle's order is drawing from, so a human reviewing the
  // order can immediately see who's considered without having to hunt per-product
  const consideredByDate = new Map<string, { name: string; reported: boolean }[]>();
  for (const date of checkDates) {
    const scheduled = scheduledStoreIdsByDate.get(date) ?? new Set<string>();
    const reported = reportedStoreIdsByDate.get(date) ?? new Set<string>();
    const list = [...scheduled]
      .map((id) => ({ name: storeNameById[id] ?? "?", reported: reported.has(id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    consideredByDate.set(date, list);
  }

  // only give an in-production delivery its own section if there's actually something expected
  // for it (an order already, or at least one store scheduled) — otherwise there's nothing to
  // warn about and it would just be an empty section for a day with nothing due
  const extraDates = inProductionDates.filter(
    (d) => !orderDates.includes(d) && (scheduledStoreIdsByDate.get(d)?.size ?? 0) > 0
  );
  const renderDates = [...new Set([...orderDates, ...extraDates])].sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Pedidos — por dia</h1>
          <p className="text-sm text-neutral-500">
            Gerado automaticamente a partir do estoque relatado pelas lojas da Unidade Rui Barbosa,
            considerando o dia de entrega cadastrado de cada loja.
          </p>
        </div>
        {profile.is_admin && (
          <form action={generateTodayProductionOrders}>
            <Button type="submit" variant="secondary">
              Gerar ordem de produção
            </Button>
          </form>
        )}
      </div>

      <PedidosTabs isAdmin={profile.is_admin} />

      {lateGroups.length > 0 && (
        <>
          <LateReportsPopup groups={lateGroups} />
          <div className="space-y-3">
            {lateGroups.map((group) => (
              <LateReportGroupCard
                key={`${group.sectorId}:${group.deliveryDate}`}
                sectorId={group.sectorId}
                sectorName={group.sectorName}
                deliveryDate={group.deliveryDate}
                deliveryLabel={`${WEEKDAY_LABELS[weekdayOfISODate(group.deliveryDate)]}, ${formatBrDate(group.deliveryDate)}`}
                items={group.items}
              />
            ))}
          </div>
        </>
      )}

      {renderDates.length === 0 && (
        <p className="text-sm text-neutral-500">Nenhuma ordem automática em aberto no momento.</p>
      )}

      {renderDates.map((deliveryDate) => {
        const bySector = tree.get(deliveryDate);
        return (
        <div key={deliveryDate} className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">
                Ordem de produção — {WEEKDAY_LABELS[weekdayOfISODate(productionDateForDelivery(deliveryDate))]},{" "}
                {formatBrDate(productionDateForDelivery(deliveryDate))}
              </h2>
              <p className="text-sm text-neutral-500">
                Entrega: {WEEKDAY_LABELS[weekdayOfISODate(deliveryDate)]}, {formatBrDate(deliveryDate)}
              </p>
            </div>
            {bySector && (
              <div className="flex items-center gap-3">
                <Link
                  href={`/pedidos/dia/imprimir?date=${deliveryDate}`}
                  className="flex items-center gap-1 text-sm font-medium text-orange-700 hover:text-orange-800"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir todas
                </Link>
                <Link
                  href={`/pedidos/dia/imprimir-romaneio?date=${deliveryDate}`}
                  className="text-sm font-medium text-orange-700 hover:text-orange-800"
                >
                  Imprimir romaneio de entrega
                </Link>
              </div>
            )}
          </div>

          {(consideredByDate.get(deliveryDate)?.length ?? 0) > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-neutral-500">Lojas consideradas nesta ordem:</span>
              {consideredByDate.get(deliveryDate)!.map((store) => (
                <span
                  key={store.name}
                  className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2 py-0.5"
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${store.reported ? "bg-green-500" : "bg-neutral-300"}`}
                  />
                  {store.name}
                </span>
              ))}
            </div>
          )}

          {missingByDate.get(deliveryDate) && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <span className="font-semibold">Pedido não recebido:</span>{" "}
              {missingByDate.get(deliveryDate)!.join(", ")}
              <span className="block text-xs text-red-700">
                Na ordem, essas lojas entram com o último pedido que enviaram, se houver.
              </span>
            </div>
          )}

          {!bySector ? (
            <p className="text-sm text-neutral-500">Nenhum pedido gerado ainda para esta entrega.</p>
          ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {[...bySector.entries()].map(([sectorId, sectorOrders]) => {
              const maxVersion = sectorOrders.reduce((max, o) => Math.max(max, o.current_version ?? 1), 1);
              return (
              <div key={sectorId} className="rounded-lg border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                  <span className="flex items-center gap-2 font-semibold text-neutral-900">
                    {sectorsById[sectorId]?.name}
                    {maxVersion > 1 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Versão {maxVersion}
                      </span>
                    )}
                  </span>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/pedidos/dia/imprimir-colaboradores?date=${deliveryDate}&sector=${sectorId}`}
                      className="flex items-center gap-1 text-xs font-medium text-orange-700 hover:text-orange-800"
                      title={`Por colaborador — ${sectorsById[sectorId]?.name}`}
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Por colaborador
                    </Link>
                  </div>
                </div>
                <div className="divide-y divide-neutral-100">
                  {sectorOrders.map((order) => {
                    const product = productsById[order.product_id];
                    const orderContributions = contributionsByOrder.get(order.id) ?? [];
                    return (
                      <div key={order.id} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-neutral-900">{product?.name ?? "—"}</span>
                          <span className="font-semibold text-neutral-900">
                            {product ? formatQuantity(order.quantity, product.unit) : order.quantity}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5">
                          {orderContributions.map((c, i) => (
                            <span key={c.store_id} className="flex items-center text-xs text-neutral-500">
                              {i > 0 && <span className="mr-1">,</span>}
                              <span className={c.locked ? "font-medium text-orange-700" : undefined}>
                                {storesById[c.store_id]?.name ?? "?"} ({c.quantity})
                              </span>
                              {(() => {
                                const report = c.report_id ? reportById.get(c.report_id) : undefined;
                                if (!report || report.delivery_date === order.delivery_date) return null;
                                return (
                                  <span
                                    className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800"
                                    title="A loja não enviou para esta entrega; usando o último pedido dela"
                                  >
                                    pedido de {formatBrDate(dateToFortalezaISO(new Date(report.created_at)))}
                                  </span>
                                );
                              })()}
                              {profile.is_admin && product && (
                                <ContributionMenu
                                  orderId={order.id}
                                  storeId={c.store_id}
                                  locked={c.locked}
                                  currentReportId={c.report_id}
                                  unit={product.unit}
                                  history={historyByStoreProduct.get(`${c.store_id}:${order.product_id}`) ?? []}
                                />
                              )}
                            </span>
                          ))}
                        </div>
                        <div className="mt-1 flex items-center justify-end">
                          <StatusBadge status={order.status} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </div>
          )}
        </div>
        );
      })}
    </div>
  );
}
