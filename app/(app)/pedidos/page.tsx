import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-session";
import { Button } from "@/components/ui/button";
import { OrderTable } from "@/components/orders/order-table";
import { PedidosTabs } from "@/components/orders/pedidos-tabs";
import type { Product, ProductionOrder, Sector } from "@/lib/types/database.types";

export default async function PedidosPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const [{ data: orders }, { data: products }, { data: sectors }] = await Promise.all([
    supabase.from("production_orders").select("*").order("created_at", { ascending: false }),
    supabase.from("products").select("*"),
    supabase.from("sectors").select("*"),
  ]);

  const productsById = Object.fromEntries(((products ?? []) as Product[]).map((p) => [p.id, p]));
  const sectorsById = Object.fromEntries(((sectors ?? []) as Sector[]).map((s) => [s.id, s]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Ordens de produção</h1>
        <Link href="/pedidos/novo">
          <Button>Nova ordem</Button>
        </Link>
      </div>

      <PedidosTabs isAdmin={profile.is_admin} />

      <OrderTable
        orders={(orders ?? []) as ProductionOrder[]}
        productsById={productsById}
        sectorsById={sectorsById}
      />
    </div>
  );
}
