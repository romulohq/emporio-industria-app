import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RouteForm } from "@/components/admin/route-form";
import { UnitFilter } from "@/components/orders/unit-filter";
import type { DeliveryRoute, ProductionUnit, Store } from "@/lib/types/database.types";

export default async function RotasPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const { unit: unitParam } = await searchParams;
  const supabase = await createClient();

  const [{ data: routes }, { data: units }, { data: stores }] = await Promise.all([
    supabase.from("delivery_routes").select("*").order("name"),
    supabase.from("production_units").select("*").order("slug"),
    supabase.from("stores").select("*"),
  ]);

  const unitsList = (units ?? []) as ProductionUnit[];
  const activeUnitSlug = unitParam ?? "rui-barbosa";
  const activeUnit = unitsList.find((u) => u.slug === activeUnitSlug);

  const filteredRoutes = ((routes ?? []) as DeliveryRoute[]).filter(
    (route) => activeUnit && route.unit_id === activeUnit.id
  );

  const storeCountByRoute = new Map<string, number>();
  for (const store of (stores ?? []) as Store[]) {
    storeCountByRoute.set(store.route_id, (storeCountByRoute.get(store.route_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">Rotas de entrega</h1>

      {unitsList.length > 0 && <UnitFilter units={unitsList} active={activeUnitSlug} basePath="/admin/rotas" />}

      <ul className="grid gap-3 sm:grid-cols-2">
        {filteredRoutes.map((route) => (
          <li key={route.id}>
            <Link
              href={`/admin/rotas/${route.id}`}
              className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-orange-300 hover:bg-orange-50"
            >
              <span className="text-sm font-medium text-neutral-900">{route.name}</span>
              <span className="text-xs text-neutral-500">
                {storeCountByRoute.get(route.id) ?? 0} lojas — ver dias de entrega →
              </span>
            </Link>
          </li>
        ))}
        {filteredRoutes.length === 0 && (
          <li className="text-sm text-neutral-500">Nenhuma rota cadastrada nesta unidade ainda.</li>
        )}
      </ul>

      <div className="max-w-lg rounded-lg border border-neutral-200 bg-white p-4">
        <RouteForm units={unitsList} defaultUnitId={activeUnit?.id} />
      </div>
    </div>
  );
}
