import { createClient } from "@/lib/supabase/server";
import { RouteForm } from "@/components/admin/route-form";
import type { DeliveryRoute } from "@/lib/types/database.types";

export default async function RotasPage() {
  const supabase = await createClient();
  const { data: routes } = await supabase
    .from("delivery_routes")
    .select("*")
    .order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">Rotas de entrega</h1>

      <ul className="grid gap-2 sm:grid-cols-2">
        {((routes ?? []) as DeliveryRoute[]).map((route) => (
          <li
            key={route.id}
            className="rounded-lg border border-neutral-200 bg-white p-4 text-sm font-medium text-neutral-900"
          >
            {route.name}
          </li>
        ))}
      </ul>

      <div className="max-w-md rounded-lg border border-neutral-200 bg-white p-4">
        <RouteForm />
      </div>
    </div>
  );
}
