import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StoreLink } from "@/components/admin/store-link";
import { StoreRowMenu } from "@/components/admin/store-row-menu";
import type { DeliveryRoute, Store } from "@/lib/types/database.types";

export default async function LojasPage() {
  const supabase = await createClient();

  const [{ data: stores }, { data: routes }] = await Promise.all([
    supabase.from("stores").select("*").order("name"),
    supabase.from("delivery_routes").select("*"),
  ]);

  const routesById = Object.fromEntries(((routes ?? []) as DeliveryRoute[]).map((r) => [r.id, r]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Lojas</h1>
        <Link href="/admin/lojas/nova">
          <Button>Nova loja</Button>
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Loja</th>
              <th className="px-4 py-2">Rota</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Link de relato de estoque</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {((stores ?? []) as Store[]).map((store) => (
              <tr key={store.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-medium text-neutral-900">{store.name}</td>
                <td className="px-4 py-2">{routesById[store.route_id]?.name ?? "—"}</td>
                <td className="px-4 py-2">
                  {store.active ? <Badge tone="green">Ativa</Badge> : <Badge>Inativa</Badge>}
                </td>
                <td className="px-4 py-2 max-w-[220px]">
                  <StoreLink path={`/relatar-estoque/${store.access_token}`} />
                </td>
                <td className="px-4 py-2 text-right">
                  <StoreRowMenu storeId={store.id} />
                </td>
              </tr>
            ))}
            {(stores ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  Nenhuma loja cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
