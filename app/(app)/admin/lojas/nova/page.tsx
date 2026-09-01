import { createClient } from "@/lib/supabase/server";
import { StoreForm } from "@/components/admin/store-form";
import { createStore } from "@/app/(app)/admin/lojas/actions";
import type { DeliveryRoute } from "@/lib/types/database.types";

export default async function NovaLojaPage() {
  const supabase = await createClient();
  const { data: routes } = await supabase.from("delivery_routes").select("*").order("name");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-neutral-900">Nova loja</h1>
      <StoreForm routes={(routes ?? []) as DeliveryRoute[]} action={createStore} />
    </div>
  );
}
