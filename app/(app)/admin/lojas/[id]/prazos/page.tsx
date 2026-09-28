import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { StoreDeliverySchedule } from "@/components/admin/store-delivery-schedule";
import type { DeliveryRoute, Store, StoreDeliveryDay } from "@/lib/types/database.types";

export default async function LojaPrazosPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: store }, { data: entries }] = await Promise.all([
    supabase.from("stores").select("*").eq("id", id).single(),
    supabase.from("store_delivery_days").select("*").eq("store_id", id),
  ]);
  if (!store) notFound();

  const { data: route } = await supabase
    .from("delivery_routes")
    .select("*")
    .eq("id", (store as Store).route_id)
    .single();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/lojas" className="text-sm font-medium text-orange-700 hover:text-orange-800">
          ← Lojas
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">
          Dias de entrega e prazos — {(store as Store).name}
        </h1>
      </div>

      <StoreDeliverySchedule
        storeId={id}
        routeName={(route as DeliveryRoute | null)?.name ?? "—"}
        initialEntries={(entries ?? []) as StoreDeliveryDay[]}
      />
    </div>
  );
}
