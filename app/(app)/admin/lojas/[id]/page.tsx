import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StoreForm } from "@/components/admin/store-form";
import { updateStore } from "@/app/(app)/admin/lojas/actions";
import type { DeliveryRoute, Store } from "@/lib/types/database.types";

export default async function EditarLojaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: store }, { data: routes }] = await Promise.all([
    supabase.from("stores").select("*").eq("id", id).single(),
    supabase.from("delivery_routes").select("*").order("name"),
  ]);

  if (!store) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-neutral-900">Editar loja</h1>
      <StoreForm
        routes={(routes ?? []) as DeliveryRoute[]}
        store={store as Store}
        action={updateStore}
      />
    </div>
  );
}
