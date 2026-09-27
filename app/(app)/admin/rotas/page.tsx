import { createClient } from "@/lib/supabase/server";
import { RouteForm } from "@/components/admin/route-form";
import { UnitFilter } from "@/components/orders/unit-filter";
import { WeeklyScheduleEditor } from "@/components/admin/weekly-schedule-editor";
import { saveUnitSchedule } from "./actions";
import type {
  DeliveryRoute,
  ProductionUnit,
  Store,
  StoreDeliveryDay,
} from "@/lib/types/database.types";

export default async function RotasPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const { unit: unitParam } = await searchParams;
  const supabase = await createClient();

  const [{ data: routes }, { data: units }, { data: allStores }] = await Promise.all([
    supabase.from("delivery_routes").select("*").order("name"),
    supabase.from("production_units").select("*").order("slug"),
    supabase.from("stores").select("*").order("name"),
  ]);

  const unitsList = (units ?? []) as ProductionUnit[];
  const routesList = (routes ?? []) as DeliveryRoute[];
  const storesList = (allStores ?? []) as Store[];

  const activeUnitSlug = unitParam ?? "rui-barbosa";
  const activeUnit = unitsList.find((u) => u.slug === activeUnitSlug);

  const unitRouteIds = new Set(routesList.filter((r) => r.unit_id === activeUnit?.id).map((r) => r.id));
  const unitStores = storesList.filter((s) => unitRouteIds.has(s.route_id));
  const storeIds = unitStores.map((s) => s.id);

  const { data: deliveryDays } = storeIds.length
    ? await supabase.from("store_delivery_days").select("*").in("store_id", storeIds)
    : { data: [] as StoreDeliveryDay[] };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900 print:hidden">Rotas de entrega</h1>

      {unitsList.length > 0 && (
        <div className="print:hidden">
          <UnitFilter units={unitsList} active={activeUnitSlug} basePath="/admin/rotas" />
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-neutral-900">
          Dias de entrega
          {activeUnit && <span className="hidden print:inline"> — {activeUnit.name}</span>}
        </h2>
        {unitStores.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma loja cadastrada nesta unidade ainda.</p>
        ) : (
          <WeeklyScheduleEditor
            unitId={activeUnit?.id ?? ""}
            stores={unitStores.map((s) => ({ id: s.id, name: s.name }))}
            initialEntries={(deliveryDays ?? []) as StoreDeliveryDay[]}
            saveAction={saveUnitSchedule}
          />
        )}
      </div>

      <details className="rounded-lg border border-neutral-200 bg-white print:hidden">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-neutral-700">
          Gerenciar rotas cadastradas
        </summary>
        <div className="space-y-4 border-t border-neutral-100 p-4">
          <ul className="grid gap-2 sm:grid-cols-2">
            {routesList
              .filter((r) => r.unit_id === activeUnit?.id)
              .map((route) => (
                <li
                  key={route.id}
                  className="rounded-lg border border-neutral-200 bg-white p-3 text-sm font-medium text-neutral-900"
                >
                  {route.name}
                </li>
              ))}
          </ul>
          <RouteForm units={unitsList} defaultUnitId={activeUnit?.id} />
        </div>
      </details>
    </div>
  );
}
