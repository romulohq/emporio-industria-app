import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { saveDeliveryDays } from "./actions";
import { WEEKDAY_ORDER, WEEKDAY_SHORT_LABELS } from "@/lib/format/labels";
import type {
  DeliveryRoute,
  ProductionUnit,
  Store,
  StoreDeliveryDay,
} from "@/lib/types/database.types";

export default async function RotaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: route } = await supabase
    .from("delivery_routes")
    .select("*")
    .eq("id", id)
    .single();

  if (!route) notFound();

  const [{ data: unit }, { data: stores }] = await Promise.all([
    supabase
      .from("production_units")
      .select("*")
      .eq("id", (route as DeliveryRoute).unit_id)
      .single(),
    supabase.from("stores").select("*").eq("route_id", id).order("name"),
  ]);

  const storesList = (stores ?? []) as Store[];
  const storeIds = storesList.map((s) => s.id);

  const { data: deliveryDays } = storeIds.length
    ? await supabase.from("store_delivery_days").select("*").in("store_id", storeIds)
    : { data: [] as StoreDeliveryDay[] };

  const scheduleByStore = new Map<string, Set<string>>();
  for (const row of (deliveryDays ?? []) as StoreDeliveryDay[]) {
    const set = scheduleByStore.get(row.store_id) ?? new Set<string>();
    set.add(row.weekday);
    scheduleByStore.set(row.store_id, set);
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/rotas" className="text-sm text-orange-600 hover:underline">
          ← Rotas de entrega
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">{(route as DeliveryRoute).name}</h1>
        <p className="text-sm text-neutral-500">
          {(unit as ProductionUnit | null)?.name} — dias de entrega por loja
        </p>
      </div>

      {storesList.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma loja cadastrada nesta rota ainda.</p>
      ) : (
        <form action={saveDeliveryDays} className="space-y-4">
          <input type="hidden" name="route_id" value={route.id} />
          {storesList.map((store) => (
            <input key={store.id} type="hidden" name="store_id" value={store.id} />
          ))}

          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Loja</th>
                  {WEEKDAY_ORDER.map((day) => (
                    <th key={day} className="px-2 py-2 text-center">
                      {WEEKDAY_SHORT_LABELS[day]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {storesList.map((store) => {
                  const active = scheduleByStore.get(store.id) ?? new Set<string>();
                  return (
                    <tr key={store.id} className="border-t border-neutral-100">
                      <td className="px-4 py-2 font-medium text-neutral-900">{store.name}</td>
                      {WEEKDAY_ORDER.map((day) => (
                        <td key={day} className="px-2 py-2 text-center">
                          <label className="inline-flex cursor-pointer items-center justify-center">
                            <input
                              type="checkbox"
                              name={`day_${store.id}_${day}`}
                              defaultChecked={active.has(day)}
                              className="peer sr-only"
                            />
                            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white text-xs font-medium text-neutral-400 transition-colors peer-checked:border-orange-600 peer-checked:bg-orange-600 peer-checked:text-white">
                              {WEEKDAY_SHORT_LABELS[day].slice(0, 1)}
                            </span>
                          </label>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Button type="submit">Salvar dias de entrega</Button>
        </form>
      )}
    </div>
  );
}
