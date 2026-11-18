import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { loadUnitScope } from "@/lib/orders/unit-scope";
import { orderUnitOf, type OrdersContext } from "@/lib/orders/units";
import { PedidosTabs } from "@/components/orders/pedidos-tabs";
import { StoreFilter } from "@/components/orders/store-filter";
import { ResponsesTable } from "@/components/orders/responses-table";
import type { ResponseItem } from "@/components/orders/response-session-row";
import { formatDateTime } from "@/lib/format/labels";
import type {
  Product,
  Sector,
  Store,
  StoreProductMin,
  StoreStockReport,
} from "@/lib/types/database.types";

const MAX_SESSIONS = 50;

export async function ResponsesView({
  ctx,
  searchParams,
}: {
  ctx: OrdersContext;
  searchParams: Promise<{ store?: string }>;
}) {
  await requireAdmin();
  const { store: storeFilter } = await searchParams;
  const supabase = await createClient();
  const scope = await loadUnitScope(supabase, ctx);

  const [{ data: allStores }, { data: products }, { data: sectors }] = await Promise.all([
    supabase.from("stores").select("*").order("name"),
    supabase.from("products").select("*"),
    supabase.from("sectors").select("*"),
  ]);

  // only this screen's stores (the cap of 2000 rows must not be spent on the other unit's reports)
  const stores = ((allStores ?? []) as Store[]).filter((s) => scope.storeIds.has(s.id));
  let reportsQuery = supabase
    .from("store_stock_reports")
    .select("*")
    .in("store_id", [...scope.storeIds])
    .order("created_at", { ascending: false })
    .limit(2000);

  if (storeFilter) reportsQuery = reportsQuery.eq("store_id", storeFilter);

  const { data: reports } = await reportsQuery;

  const storesById = Object.fromEntries(((stores ?? []) as Store[]).map((s) => [s.id, s]));
  const productsById = Object.fromEntries(((products ?? []) as Product[]).map((p) => [p.id, p]));
  const sectorsById = Object.fromEntries(((sectors ?? []) as Sector[]).map((s) => [s.id, s]));

  const involvedStoreIds = [...new Set((reports ?? []).map((r) => r.store_id))];
  const { data: mins } = involvedStoreIds.length
    ? await supabase.from("store_product_mins").select("*").in("store_id", involvedStoreIds)
    : { data: [] as StoreProductMin[] };
  const minByStoreProduct = new Map(
    ((mins ?? []) as StoreProductMin[]).map((m) => [`${m.store_id}:${m.product_id}`, m.min_quantity])
  );

  // group individual product rows back into one "envio" (submission) per card
  type Session = { submissionId: string; storeId: string; createdAt: string; items: ResponseItem[] };
  const sessionsById = new Map<string, Session>();
  for (const report of (reports ?? []) as StoreStockReport[]) {
    const product = productsById[report.product_id];
    const session = sessionsById.get(report.submission_id) ?? {
      submissionId: report.submission_id,
      storeId: report.store_id,
      createdAt: report.created_at,
      items: [],
    };
    const minQuantity = minByStoreProduct.get(`${report.store_id}:${report.product_id}`) ?? null;
    session.items.push({
      reportId: report.id,
      storeId: report.store_id,
      productId: report.product_id,
      productName: product?.name ?? "—",
      sectorName: product ? (sectorsById[product.sector_id]?.name ?? "—") : "—",
      unit: product ? orderUnitOf(product) : "",
      quantity: report.quantity_reported,
      minQuantity,
      toProduce:
        minQuantity === null
          ? null
          : Math.max(0, Math.round((minQuantity - report.quantity_reported) * 1000) / 1000),
    });
    sessionsById.set(report.submission_id, session);
  }
  const sessions = [...sessionsById.values()]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, MAX_SESSIONS);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Respostas das lojas</h1>
        <p className="text-sm text-neutral-500">
          Últimos {MAX_SESSIONS} envios do formulário de estoque, um por loja/horário — clique em
          &ldquo;Ver detalhes&rdquo; pra abrir os produtos daquele envio. Para apagar registros, marque os envios e use &ldquo;Excluir
          selecionados&rdquo; (ou a lixeira da linha).
        </p>
      </div>

      <PedidosTabs isAdmin basePath={ctx.basePath} />

      <div className="max-w-xs">
        <StoreFilter stores={stores} value={storeFilter ?? ""} basePath={ctx.basePath} />
      </div>

      <ResponsesTable
        sessions={sessions.map((session) => ({
          submissionId: session.submissionId,
          storeName: storesById[session.storeId]?.name ?? "—",
          createdAt: formatDateTime(session.createdAt),
          items: session.items,
        }))}
      />
    </div>
  );
}
