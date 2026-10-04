import Link from "next/link";
import { Printer, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-session";
import { PedidosTabs } from "@/components/orders/pedidos-tabs";
import { ContributionMenu, type ContributionHistoryItem } from "@/components/orders/contribution-menu";
import { LateStoreCard } from "@/components/orders/late-store-card";
import { LateReportsPopup } from "@/components/orders/late-reports-popup";
import { updateDayOrders } from "./actions";
import { getUndecidedLateReports } from "@/lib/orders/late-reports";
import { groupLateReportsByStore } from "@/lib/orders/group-late-by-store";
import {
  deliveryDatesInProduction,
  productionDateForDelivery,
  sendDeadlineForDelivery,
} from "@/lib/delivery-schedule";
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

type StoreSendState = "on_time" | "late" | "missing" | "none";

const SEND_STATE_DOT: Record<StoreSendState, string> = {
  on_time: "bg-green-500",
  late: "bg-orange-400",
  missing: "bg-red-500",
  none: "bg-neutral-300",
};

const SEND_STATE_LEGEND = [
  { state: "on_time", label: "Pedido enviado" },
  { state: "late", label: "Enviado atrasado" },
  { state: "missing", label: "Pedido não enviado" },
  { state: "none", label: "Nenhum pedido no sistema" },
] as const;

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
  const lateStores = profile.is_admin ? groupLateReportsByStore(await getUndecidedLateReports()) : [];
  const lateCount = lateStores.length;

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
      ? supabase.from("store_stock_reports").select("store_id, delivery_date, created_at").in("delivery_date", checkDates)
      : Promise.resolve({ data: [] as { store_id: string; delivery_date: string | null; created_at: string }[] }),
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
  const onTimeStoreIdsByDate = new Map<string, Set<string>>();
  const onTimeSentAt = new Map<string, number>();
  const reportedSentAt = new Map<string, number>();
  for (const r of (cycleReports ?? []) as { store_id: string; delivery_date: string | null; created_at: string }[]) {
    if (!r.delivery_date) continue;
    const set = reportedStoreIdsByDate.get(r.delivery_date) ?? new Set<string>();
    set.add(r.store_id);
    reportedStoreIdsByDate.set(r.delivery_date, set);

    const sentAt = new Date(r.created_at).getTime();
    const reportedKey = `${r.delivery_date}:${r.store_id}`;
    reportedSentAt.set(reportedKey, Math.min(reportedSentAt.get(reportedKey) ?? Infinity, sentAt));
    if (sentAt <= sendDeadlineForDelivery(r.delivery_date).getTime()) {
      const onTime = onTimeStoreIdsByDate.get(r.delivery_date) ?? new Set<string>();
      onTime.add(r.store_id);
      onTimeStoreIdsByDate.set(r.delivery_date, onTime);

      const key = `${r.delivery_date}:${r.store_id}`;
      onTimeSentAt.set(key, Math.min(onTimeSentAt.get(key) ?? Infinity, sentAt));
    }
  }

  // stores that never sent any order to the system, for any delivery (new stores)
  const neverReportedStoreIds = new Set<string>();
  const lastSentAtByStore = new Map<string, number>();
  const storesWithoutCycleReport = new Set<string>();
  for (const date of checkDates) {
    for (const id of scheduledStoreIdsByDate.get(date) ?? []) {
      if (!reportedStoreIdsByDate.get(date)?.has(id)) storesWithoutCycleReport.add(id);
    }
  }
  await Promise.all(
    [...storesWithoutCycleReport].map(async (storeId) => {
      const { data } = await supabase
        .from("store_stock_reports")
        .select("created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (!data?.length) neverReportedStoreIds.add(storeId);
      else lastSentAtByStore.set(storeId, new Date(data[0].created_at).getTime());
    })
  );

  const allScheduledStoreIds = new Set<string>();
  for (const ids of scheduledStoreIdsByDate.values()) for (const id of ids) allScheduledStoreIds.add(id);
  const { data: allStoresForMissing } = allScheduledStoreIds.size
    ? await supabase.from("stores").select("id, name").in("id", [...allScheduledStoreIds])
    : { data: [] as { id: string; name: string }[] };
  const storeNameById = Object.fromEntries((allStoresForMissing ?? []).map((s) => [s.id, s.name]));

  // full set of stores this cycle's order is drawing from, so a human reviewing the
  // order can immediately see who's considered without having to hunt per-product
  // green = sent on time for this delivery; orange = sent for it, but after the deadline;
  // red = nothing sent for it (an earlier order is in the system); gray = this store has
  // never sent any order to the system
  // listed green, orange, red, gray; within each, by send time (oldest first — on-time and
  // late by this delivery's send, red by the store's latest earlier send)
  const STATE_RANK: Record<StoreSendState, number> = { on_time: 0, late: 1, missing: 2, none: 3 };
  const consideredByDate = new Map<string, { name: string; state: StoreSendState }[]>();
  for (const date of checkDates) {
    const scheduled = scheduledStoreIdsByDate.get(date) ?? new Set<string>();
    const onTime = onTimeStoreIdsByDate.get(date) ?? new Set<string>();
    const reported = reportedStoreIdsByDate.get(date) ?? new Set<string>();
    const list = [...scheduled]
      .map((id) => {
        const state: StoreSendState = onTime.has(id)
          ? "on_time"
          : reported.has(id)
            ? "late"
            : neverReportedStoreIds.has(id)
              ? "none"
              : "missing";
        const sentAt =
          state === "on_time"
            ? onTimeSentAt.get(`${date}:${id}`)
            : state === "late"
              ? reportedSentAt.get(`${date}:${id}`)
              : state === "missing"
                ? lastSentAtByStore.get(id)
                : undefined;
        return { name: storeNameById[id] ?? "?", state, sentAt: sentAt ?? Infinity };
      })
      .sort(
        (a, b) =>
          STATE_RANK[a.state] - STATE_RANK[b.state] || a.sentAt - b.sentAt || a.name.localeCompare(b.name)
      );
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
          <form action={updateDayOrders} className="shrink-0">
            <button
              type="submit"
              disabled={lateCount === 0}
              title={lateCount === 0 ? "Nenhum pedido atrasado — ordem atualizada" : "Incluir os pedidos atrasados na ordem"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-orange-600"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar ordem de produção
              {lateCount > 0 && (
                <span className="rounded-full bg-white px-1.5 text-[10px] font-bold leading-4 text-orange-700">
                  {lateCount}
                </span>
              )}
            </button>
          </form>
        )}
      </div>

      <PedidosTabs isAdmin={profile.is_admin} />

      {lateStores.length > 0 && (
        <>
          <LateReportsPopup stores={lateStores} />
          <div className="space-y-2">
            {lateStores.map((store) => (
              <LateStoreCard
                key={`${store.storeId}:${store.deliveryDate}`}
                storeId={store.storeId}
                storeName={store.storeName}
                deliveryDate={store.deliveryDate}
                deliveryLabel={`${WEEKDAY_LABELS[weekdayOfISODate(store.deliveryDate)]}, ${formatBrDate(store.deliveryDate)}`}
                sentAt={store.sentAt}
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
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
                <span className="font-medium text-neutral-500">Lojas consideradas nesta ordem</span>
                {SEND_STATE_LEGEND.map((item) => (
                  <span key={item.state} className="flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${SEND_STATE_DOT[item.state]}`} />
                    {item.label}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {consideredByDate.get(deliveryDate)!.map((store) => (
                  <span
                    key={store.name}
                    title={SEND_STATE_LEGEND.find((i) => i.state === store.state)?.label}
                    className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2 py-0.5"
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SEND_STATE_DOT[store.state]}`} />
                    {store.name}
                  </span>
                ))}
              </div>
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
