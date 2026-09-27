import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateSectorResponsible } from "./actions";
import type { Sector } from "@/lib/types/database.types";

export default async function SetoresPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: sectors } = await supabase.from("sectors").select("*").order("name");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Setores</h1>
        <p className="text-sm text-neutral-500">
          O responsável cadastrado aqui aparece na ordem de produção impressa para o setor.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {((sectors ?? []) as Sector[]).map((sector) => (
          <li key={sector.id} className="rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-sm font-semibold text-neutral-900">{sector.name}</p>
            <form action={updateSectorResponsible} className="mt-3 flex items-center gap-2">
              <input type="hidden" name="id" value={sector.id} />
              <Input
                name="responsible_name"
                placeholder="Responsável pela produção"
                defaultValue={sector.responsible_name ?? ""}
                className="flex-1"
              />
              <Button type="submit" variant="secondary">
                Salvar
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
