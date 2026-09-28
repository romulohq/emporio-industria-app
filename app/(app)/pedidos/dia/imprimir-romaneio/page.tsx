import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-session";
import { PrintButton } from "@/components/orders/print-button";
import { StorePicker } from "@/components/orders/store-picker";
import { CollaboratorSheet, type CollaboratorSheetItem } from "@/components/orders/collaborator-sheet";
import { weekdayOfISODate, formatBrDate } from "@/lib/dates";
import { WEEKDAY_LABELS } from "@/lib/format/labels";
import type { Product, ProductionOrder, ProductionOrderContribution, Store } from "@/lib/types/database.types";

type Sheet = { key: string; title: string; items: CollaboratorSheetItem[] };

export default async function ImprimirRomaneioPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; loja?: string }>;
}) {
  await requireUser();
  const { date, loja: storeParam } = await searchParams;
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
  const productIds = ordersList.map((o) => o.product_id);

  const [{ data: contributions }, { data: products }] = await Promise.all([
    orderIds.length
      ? supabase.from("production_order_contributions").select("*").in("order_id", orderIds)
      : Promise.resolve({ data: [] as ProductionOrderContribution[] }),
    productIds.length
      ? supabase.from("products").select("*").in("id", productIds)
      : Promise.resolve({ data: [] as Product[] }),
  ]);

  const contributionsList = (contributions ?? []) as ProductionOrderContribution[];
  const storeIds = [...new Set(contributionsList.map((c) => c.store_id))];
  const { data: stores } = storeIds.length
    ? await supabase.from("stores").select("*").in("id", storeIds)
    : { data: [] as Store[] };

  const productsById = Object.fromEntries(((products ?? []) as Product[]).map((p) => [p.id, p]));
  const ordersById = Object.fromEntries(ordersList.map((o) => [o.id, o]));
  const storesById = Object.fromEntries(((stores ?? []) as Store[]).map((s) => [s.id, s]));

  const itemsByStore = new Map<string, CollaboratorSheetItem[]>();
  for (const contribution of contributionsList) {
    const order = ordersById[contribution.order_id];
    const product = order ? productsById[order.product_id] : undefined;
    if (!order || !product) continue;

    const list = itemsByStore.get(contribution.store_id) ?? [];
    list.push({ id: contribution.order_id, name: product.name, unit: product.unit, quantity: contribution.quantity });
    itemsByStore.set(contribution.store_id, list);
  }

  const sortByName = (items: CollaboratorSheetItem[]) => [...items].sort((a, b) => a.name.localeCompare(b.name));

  const sheets: Sheet[] = storeIds
    .map((storeId) => ({
      key: storeId,
      title: storesById[storeId]?.name ?? "—",
      items: sortByName(itemsByStore.get(storeId) ?? []),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const visibleSheets = storeParam ? sheets.filter((s) => s.key === storeParam) : sheets;

  const subtitle = `Romaneio de entrega · ${WEEKDAY_LABELS[weekdayOfISODate(date)]}, ${formatBrDate(date)}`;

  const pickerOptions = sheets.map((s) => ({ value: s.key, label: s.title }));

  return (
    <div className="space-y-6 p-6 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/pedidos/dia" className="text-sm font-medium text-orange-700 hover:text-orange-800">
          ← Voltar
        </Link>
        <div className="flex items-center gap-2">
          <StorePicker date={date} options={pickerOptions} />
          <PrintButton />
        </div>
      </div>

      {visibleSheets.length === 0 && (
        <p className="text-sm text-neutral-500">Nenhum pedido para esta data.</p>
      )}

      {visibleSheets.map((sheet, index) => (
        <CollaboratorSheet
          key={sheet.key}
          subtitle={subtitle}
          title={sheet.title}
          items={sheet.items}
          isFirst={index === 0}
          checkColumnLabel="Recebido ✓"
        />
      ))}
    </div>
  );
}
