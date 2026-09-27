import Link from "next/link";
import { Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-session";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/orders/status-badge";
import { PedidosTabs } from "@/components/orders/pedidos-tabs";
import { ContributionMenu, type ContributionHistoryItem } from "@/components/orders/contribution-menu";
import { updateOrderStatus } from "@/app/(app)/pedidos/actions";
import { generateTomorrowOrders, useLateReport, dismissLateReport } from "./actions";
import { weekdayOfISODate, formatBrDate } from "@/lib/dates";
import { STATUS_LABELS, STATUS_ORDER, WEEKDAY_LABELS, formatDateTime, formatQuantity } from "@/lib/format/labels";
import type {
  Product,
  ProductionOrder,
  ProductionOrderContribution,
  Sector,
  Store,
  StoreStockReport,
} from "@/lib/types/database.types";

export default async function OrdensPorDiaPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const [{ data: orders }, { data: sectors }, { data: products }] = await Promise.all([
    supabase
      .from("production_orders")
      .select("*")
      .eq("source", "auto_route")
      .in("status", ["pending", "in_progress"])
      .order("delivery_date", { ascending: true }),
    supabase.from("sectors").select("*"),
    supabase.from("products").select("*"),
  ]);

  const orderIds = (orders ?? []).map((o) => o.id);
  const { data: contributions } = orderIds.length
    ? await supabase.from("production_order_contributions").select("*").in("order_id", orderIds)
    : { data: [] as ProductionOrderContribution[] };

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

  // admins see a "late report" inbox for stragglers that missed an already-generated order
  type LateReport = {
    reportId: string;
    storeName: string;
    productName: string;
    unit: string;
    quantityReported: number;
    createdAt: string;
  };
  const lateReports: LateReport[] = [];
  if (profile.is_admin) {
    const { data: late } = await supabase
      .from("store_stock_reports")
      .select("*")
      .not("late_for_order_id", "is", null)
      .eq("late_acknowledged", false)
      .order("created_at", { ascending: false });

    const lateRows = (late ?? []) as StoreStockReport[];
    if (lateRows.length) {
      const lateStoreIds = [...new Set(lateRows.map((r) => r.store_id))];
      const lateProductIds = [...new Set(lateRows.map((r) => r.product_id))];
      const [{ data: lateStores }, { data: lateProducts }] = await Promise.all([
        supabase.from("stores").select("*").in("id", lateStoreIds),
        supabase.from("products").select("*").in("id", lateProductIds),
      ]);
      const lateStoresById = Object.fromEntries(((lateStores ?? []) as Store[]).map((s) => [s.id, s]));
      const lateProductsById = Object.fromEntries(((lateProducts ?? []) as Product[]).map((p) => [p.id, p]));

      for (const report of lateRows) {
        const product = lateProductsById[report.product_id];
        lateReports.push({
          reportId: report.id,
          storeName: lateStoresById[report.store_id]?.name ?? "?",
          productName: product?.name ?? "?",
          unit: product?.unit ?? "",
          quantityReported: report.quantity_reported,
          createdAt: report.created_at,
        });
      }
    }
  }

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
          <form action={generateTomorrowOrders}>
            <Button type="submit" variant="secondary">
              Gerar ordem de produção
            </Button>
          </form>
        )}
      </div>

      <PedidosTabs isAdmin={profile.is_admin} />

      {lateReports.length > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-semibold text-orange-800">
            {lateReports.length === 1 ? "1 pedido atrasado" : `${lateReports.length} pedidos atrasados`} — chegaram
            depois do pedido do dia já ter sido gerado
          </p>
          <div className="mt-2 space-y-2">
            {lateReports.map((report) => (
              <div
                key={report.reportId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm"
              >
                <span className="text-neutral-700">
                  <span className="font-medium text-neutral-900">{report.storeName}</span> — {report.productName}:{" "}
                  {formatQuantity(report.quantityReported, report.unit)} relatado ({formatDateTime(report.createdAt)})
                </span>
                <div className="flex items-center gap-2">
                  <form action={useLateReport}>
                    <input type="hidden" name="report_id" value={report.reportId} />
                    <button
                      type="submit"
                      className="rounded-md bg-orange-600 px-2 py-1 text-xs text-white hover:bg-orange-700"
                    >
                      Usar este valor
                    </button>
                  </form>
                  <form action={dismissLateReport}>
                    <input type="hidden" name="report_id" value={report.reportId} />
                    <button
                      type="submit"
                      className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                    >
                      Ignorar
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {dateEntries.length === 0 && (
        <p className="text-sm text-neutral-500">Nenhuma ordem automática em aberto no momento.</p>
      )}

      {dateEntries.map(([deliveryDate, bySector]) => (
        <div key={deliveryDate} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-900">
              Ordem de produção — {WEEKDAY_LABELS[weekdayOfISODate(deliveryDate)]}, {formatBrDate(deliveryDate)}
            </h2>
            <Link
              href={`/pedidos/dia/imprimir?date=${deliveryDate}`}
              className="text-sm font-medium text-orange-700 hover:text-orange-800"
            >
              Imprimir
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {[...bySector.entries()].map(([sectorId, sectorOrders]) => (
              <div key={sectorId} className="rounded-lg border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                  <span className="font-semibold text-neutral-900">{sectorsById[sectorId]?.name}</span>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/pedidos/dia/imprimir-setor?date=${deliveryDate}&sector=${sectorId}`}
                      className="flex items-center gap-1 text-xs font-medium text-orange-700 hover:text-orange-800"
                      title={`Ordem completa — ${sectorsById[sectorId]?.name}`}
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Ordem completa
                    </Link>
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
                        <form action={updateOrderStatus} className="mt-2 flex items-center gap-2">
                          <input type="hidden" name="order_id" value={order.id} />
                          <select
                            name="status"
                            defaultValue={order.status}
                            className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
                          >
                            {STATUS_ORDER.map((status) => (
                              <option key={status} value={status}>
                                {STATUS_LABELS[status]}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="rounded-md bg-orange-600 px-2 py-1 text-xs text-white hover:bg-orange-700"
                          >
                            Aplicar
                          </button>
                        </form>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
