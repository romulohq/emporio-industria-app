import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-session";
import { Button } from "@/components/ui/button";
import { OrderTable } from "@/components/orders/order-table";
import { PedidosTabs } from "@/components/orders/pedidos-tabs";
import { UnitFilter } from "@/components/orders/unit-filter";
import type { Product, ProductionOrder, ProductionUnit, Sector } from "@/lib/types/database.types";

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const { profile } = await requireUser();
  const { unit: unitParam } = await searchParams;
  const supabase = await createClient();

  const [{ data: orders }, { data: products }, { data: sectors }, { data: units }] =
    await Promise.all([
      supabase.from("production_orders").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("*"),
      supabase.from("sectors").select("*"),
      supabase.from("production_units").select("*").order("slug"),
    ]);

  const productsById = Object.fromEntries(((products ?? []) as Product[]).map((p) => [p.id, p]));
  const sectorsById = Object.fromEntries(((sectors ?? []) as Sector[]).map((s) => [s.id, s]));
  const unitsList = (units ?? []) as ProductionUnit[];

  const activeUnitSlug = unitParam ?? "rui-barbosa";
  const activeUnit = unitsList.find((u) => u.slug === activeUnitSlug);

  const filteredOrders = ((orders ?? []) as ProductionOrder[]).filter((order) => {
    const sector = sectorsById[order.sector_id];
    return sector && activeUnit && sector.unit_id === activeUnit.id;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Gestão de pedidos</h1>
        <Link href="/pedidos/novo">
          <Button>Nova ordem</Button>
        </Link>
      </div>

      <PedidosTabs isAdmin={profile.is_admin} />

      {unitsList.length > 0 && <UnitFilter units={unitsList} active={activeUnitSlug} />}

      <OrderTable orders={filteredOrders} productsById={productsById} sectorsById={sectorsById} />
    </div>
  );
}
