import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { PedidosTabs } from "@/components/orders/pedidos-tabs";
import { StoreFilter } from "@/components/orders/store-filter";
import { ResponseSessionRow, type ResponseItem } from "@/components/orders/response-session-row";
import { formatDateTime } from "@/lib/format/labels";
import type {
  Product,
  Sector,
  Store,
  StoreProductMin,
  StoreStockReport,
} from "@/lib/types/database.types";

const MAX_SESSIONS = 50;

export default async function RespostasLojasPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  await requireAdmin();
  const { store: storeFilter } = await searchParams;
  const supabase = await createClient();

  const [{ data: stores }, { data: products }, { data: sectors }] = await Promise.all([
    supabase.from("stores").select("*").order("name"),
    supabase.from("products").select("*"),
    supabase.from("sectors").select("*"),
  ]);

  let reportsQuery = supabase
    .from("store_stock_reports")
    .select("*")
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
      unit: product?.unit ?? "",
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
          &ldquo;Ver detalhes&rdquo; pra abrir os produtos daquele envio. Corrigir um valor
          registra um novo envio (não apaga o histórico) e já recalcula as ordens
          automaticamente.
        </p>
      </div>

      <PedidosTabs isAdmin />

      <div className="max-w-xs">
        <StoreFilter stores={(stores ?? []) as Store[]} value={storeFilter ?? ""} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Data/hora</th>
              <th className="px-4 py-2">Loja</th>
              <th className="px-4 py-2">Itens</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <ResponseSessionRow
                key={session.submissionId}
                storeName={storesById[session.storeId]?.name ?? "—"}
                createdAt={formatDateTime(session.createdAt)}
                items={session.items}
              />
            ))}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                  Nenhuma resposta registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
