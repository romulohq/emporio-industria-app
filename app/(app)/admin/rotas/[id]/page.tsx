import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeliveryDaysEditor } from "@/components/admin/delivery-days-editor";
import { saveDeliveryDays } from "./actions";
import type {
  DeliveryRoute,
  ProductionUnit,
  Store,
  StoreDeliveryDay,
  Weekday,
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

  const initialSchedule: Record<string, Weekday[]> = {};
  for (const row of (deliveryDays ?? []) as StoreDeliveryDay[]) {
    (initialSchedule[row.store_id] ??= []).push(row.weekday);
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
        <DeliveryDaysEditor
          routeId={id}
          stores={storesList.map((s) => ({ id: s.id, name: s.name }))}
          initialSchedule={initialSchedule}
          saveAction={saveDeliveryDays}
        />
      )}
    </div>
  );
}
