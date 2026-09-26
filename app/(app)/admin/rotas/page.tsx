import { createClient } from "@/lib/supabase/server";
import { RouteForm } from "@/components/admin/route-form";
import { UnitFilter } from "@/components/orders/unit-filter";
import type { DeliveryRoute, ProductionUnit } from "@/lib/types/database.types";

export default async function RotasPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const { unit: unitParam } = await searchParams;
  const supabase = await createClient();

  const [{ data: routes }, { data: units }] = await Promise.all([
    supabase.from("delivery_routes").select("*").order("name"),
    supabase.from("production_units").select("*").order("slug"),
  ]);

  const unitsList = (units ?? []) as ProductionUnit[];
  const activeUnitSlug = unitParam ?? "rui-barbosa";
  const activeUnit = unitsList.find((u) => u.slug === activeUnitSlug);

  const filteredRoutes = ((routes ?? []) as DeliveryRoute[]).filter(
    (route) => activeUnit && route.unit_id === activeUnit.id
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">Rotas de entrega</h1>

      {unitsList.length > 0 && <UnitFilter units={unitsList} active={activeUnitSlug} basePath="/admin/rotas" />}

      <ul className="grid gap-2 sm:grid-cols-2">
        {filteredRoutes.map((route) => (
          <li
            key={route.id}
            className="rounded-lg border border-neutral-200 bg-white p-4 text-sm font-medium text-neutral-900"
          >
            {route.name}
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
