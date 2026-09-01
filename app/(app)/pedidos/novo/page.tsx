import { createClient } from "@/lib/supabase/server";
import { OrderForm } from "@/components/orders/order-form";
import type { Product, Sector } from "@/lib/types/database.types";

export default async function NovaOrdemPage() {
  const supabase = await createClient();

  const [{ data: products }, { data: sectors }] = await Promise.all([
    supabase.from("products").select("*").eq("active", true).order("name"),
    supabase.from("sectors").select("*"),
  ]);

  const sectorsById = Object.fromEntries(((sectors ?? []) as Sector[]).map((s) => [s.id, s]));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-neutral-900">Nova ordem de produção</h1>
      <OrderForm products={(products ?? []) as Product[]} sectorsById={sectorsById} />
    </div>
  );
}
