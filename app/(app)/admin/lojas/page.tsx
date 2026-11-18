import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StoreLink } from "@/components/admin/store-link";
import { StoreRowMenu } from "@/components/admin/store-row-menu";
import { OSORIO_ORDERS, RUI_ORDERS } from "@/lib/orders/units";
import { cn } from "@/lib/utils";
import type { DeliveryRoute, ProductionUnit, Store } from "@/lib/types/database.types";

const FRONTS = [
  { ctx: RUI_ORDERS, label: "Rui Barbosa", linkTitle: "Relatar estoque Confeitaria e Pães embalados" },
  { ctx: OSORIO_ORDERS, label: "Osório (congelados)", linkTitle: "Relatar estoque de congelados" },
];

export default async function LojasPage({ searchParams }: { searchParams: Promise<{ unit?: string }> }) {
  const { unit: unitParam } = await searchParams;
  const supabase = await createClient();

  const [{ data: stores }, { data: routes }, { data: units }] = await Promise.all([
    supabase.from("stores").select("*").order("name"),
    supabase.from("delivery_routes").select("*"),
    supabase.from("production_units").select("*"),
  ]);

  const routesById = Object.fromEntries(((routes ?? []) as DeliveryRoute[]).map((r) => [r.id, r]));
  const unitsById = Object.fromEntries(((units ?? []) as ProductionUnit[]).map((u) => [u.id, u]));
  const unitSlugOf = (store: Store) => unitsById[routesById[store.route_id]?.unit_id ?? ""]?.slug ?? "";

  const active = FRONTS.find((f) => f.ctx.unitSlug === unitParam)?.ctx.unitSlug ?? "";
  const frontOrder = (slug: string) => FRONTS.findIndex((f) => f.ctx.unitSlug === slug);
  const shown = ((stores ?? []) as Store[])
    .filter((s) => !active || unitSlugOf(s) === active)
    .sort((a, b) => frontOrder(unitSlugOf(a)) - frontOrder(unitSlugOf(b)) || a.name.localeCompare(b.name, "pt"));

  const tabs = [{ slug: "", label: "Todas" }, ...FRONTS.map((f) => ({ slug: f.ctx.unitSlug, label: f.label }))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Lojas</h1>
        <Link href="/admin/lojas/nova">
          <Button>Nova loja</Button>
        </Link>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {FRONTS.map((f) => (
          <div key={f.ctx.key} className="rounded-lg border border-orange-200 bg-orange-50/50 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">
              {f.linkTitle} <span className="font-normal text-neutral-500">(link geral — {f.label})</span>
            </p>
            <p className="mt-0.5 text-xs text-neutral-600">
              Quem abre este link escolhe a própria loja e cai no formulário dela. Útil para mandar um único endereço a todos.
            </p>
            <div className="mt-1.5">
              <StoreLink path={f.ctx.storePickerPath} />
            </div>
          </div>
        ))}
      </div>

      <div className="inline-flex rounded-full border border-neutral-200 bg-neutral-100 p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.slug || "all"}
            href={tab.slug ? `/admin/lojas?unit=${tab.slug}` : "/admin/lojas"}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              active === tab.slug ? "bg-orange-600 text-white" : "text-neutral-600 hover:text-neutral-900"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Loja</th>
              <th className="px-4 py-2">Pedidos</th>
              <th className="px-4 py-2">Rota</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Link de relato de estoque</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {shown.map((store) => (
              <tr key={store.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-medium text-neutral-900">{store.name}</td>
                <td className="px-4 py-2 text-neutral-600">
                  {FRONTS.find((f) => f.ctx.unitSlug === unitSlugOf(store))?.label ?? "—"}
                </td>
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
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
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
