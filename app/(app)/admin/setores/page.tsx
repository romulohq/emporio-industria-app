import { createClient } from "@/lib/supabase/server";
import type { Sector } from "@/lib/types/database.types";

export default async function SetoresPage() {
  const supabase = await createClient();
  const { data: sectors } = await supabase.from("sectors").select("*").order("name");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-neutral-900">Setores</h1>
      <ul className="grid gap-2 sm:grid-cols-2">
        {((sectors ?? []) as Sector[]).map((sector) => (
          <li
            key={sector.id}
            className="rounded-lg border border-neutral-200 bg-white p-4 text-sm font-medium text-neutral-900"
          >
            {sector.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
