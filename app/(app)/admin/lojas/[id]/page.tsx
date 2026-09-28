import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StoreForm } from "@/components/admin/store-form";
import { StoreDeliverySchedule } from "@/components/admin/store-delivery-schedule";
import { updateStore } from "@/app/(app)/admin/lojas/actions";
import type { DeliveryRoute, Store, StoreDeliveryDay } from "@/lib/types/database.types";

export default async function EditarLojaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: store }, { data: routes }, { data: deliveryDays }] = await Promise.all([
    supabase.from("stores").select("*").eq("id", id).single(),
    supabase.from("delivery_routes").select("*").order("name"),
    supabase.from("store_delivery_days").select("*").eq("store_id", id),
  ]);

  if (!store) notFound();

  const routesById = Object.fromEntries(((routes ?? []) as DeliveryRoute[]).map((r) => [r.id, r]));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">Editar loja</h1>
      <StoreForm
        routes={(routes ?? []) as DeliveryRoute[]}
        store={store as Store}
        action={updateStore}
      />

      <div className="border-t border-neutral-200 pt-6">
        <h2 className="mb-3 text-lg font-semibold text-neutral-900">Dias de entrega e prazos</h2>
        <StoreDeliverySchedule
          storeId={id}
          routeName={routesById[(store as Store).route_id]?.name ?? "—"}
          initialEntries={(deliveryDays ?? []) as StoreDeliveryDay[]}
        />
      </div>
    </div>
  );
}
