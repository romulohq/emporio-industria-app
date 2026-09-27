import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-session";
import { PrintButton } from "@/components/orders/print-button";
import { OrderQuantityTable } from "@/components/orders/order-quantity-table";
import { weekdayOfISODate, formatBrDate } from "@/lib/dates";
import { WEEKDAY_LABELS } from "@/lib/format/labels";
import type { Product, ProductionOrder, Sector } from "@/lib/types/database.types";

export default async function ImprimirOrdemDoSetorPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; sector?: string }>;
}) {
  await requireUser();
  const { date, sector: sectorId } = await searchParams;
  const supabase = await createClient();

  if (!date || !sectorId) {
    return <p className="p-6 text-sm text-neutral-500">Informe data e setor (?date=AAAA-MM-DD&sector=ID) na URL.</p>;
  }

  const [{ data: sector }, { data: orders }] = await Promise.all([
    supabase.from("sectors").select("*").eq("id", sectorId).single(),
    supabase
      .from("production_orders")
      .select("*")
      .eq("source", "auto_route")
      .eq("delivery_date", date)
      .eq("sector_id", sectorId)
      .in("status", ["pending", "in_progress", "completed"]),
  ]);

  const ordersList = (orders ?? []) as ProductionOrder[];
  const productIds = ordersList.map((o) => o.product_id);
  const { data: products } = productIds.length
    ? await supabase.from("products").select("*").in("id", productIds)
    : { data: [] as Product[] };
  const productsById = Object.fromEntries(((products ?? []) as Product[]).map((p) => [p.id, p]));

  const sortedOrders = [...ordersList].sort((a, b) =>
    (productsById[a.product_id]?.name ?? "").localeCompare(productsById[b.product_id]?.name ?? "")
  );

  const groups = new Map<number, ProductionOrder[]>();
  const ungrouped: ProductionOrder[] = [];
  for (const order of sortedOrders) {
    const group = productsById[order.product_id]?.production_group;
    if (group) {
      const list = groups.get(group) ?? [];
      list.push(order);
      groups.set(group, list);
    } else {
      ungrouped.push(order);
    }
  }
  const sortedGroupNumbers = [...groups.keys()].sort((a, b) => a - b);
  const sectorName = (sector as Sector | null)?.name ?? "";
  const groupLabel = (n: number) => (sectorName === "Confeitaria" ? `Confeiteira ${n}` : `Grupo ${n}`);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 print:p-0">
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
          Ordem de produção — {(sector as Sector | null)?.name ?? "—"}
        </h1>
        <p className="text-sm text-neutral-600">
          {WEEKDAY_LABELS[weekdayOfISODate(date)]}, {formatBrDate(date)}
        </p>
      </header>

      {sortedOrders.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum pedido para este setor nesta data.</p>
      ) : sortedGroupNumbers.length === 0 ? (
        <OrderQuantityTable orders={sortedOrders} productsById={productsById} />
      ) : (
        <div className="space-y-5">
          {sortedGroupNumbers.map((n) => (
            <section key={n} className="space-y-2 break-inside-avoid">
              <h2 className="text-lg font-bold text-orange-700">{groupLabel(n)}</h2>
              <OrderQuantityTable orders={groups.get(n)!} productsById={productsById} />
            </section>
          ))}
          {ungrouped.length > 0 && (
            <section className="space-y-2 break-inside-avoid">
              <h2 className="text-lg font-bold text-neutral-500">Sem grupo definido</h2>
              <OrderQuantityTable orders={ungrouped} productsById={productsById} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
