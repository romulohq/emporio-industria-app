import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { updateUserSectors } from "@/app/(app)/admin/usuarios/actions";
import type { Profile, Sector, UserSector } from "@/lib/types/database.types";

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: profile }, { data: sectors }, { data: links }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).single(),
    supabase.from("sectors").select("*").order("name"),
    supabase.from("user_sectors").select("*").eq("user_id", id),
  ]);

  if (!profile) notFound();

  const p = profile as Profile;
  const selected = new Set(((links ?? []) as UserSector[]).map((l) => l.sector_id));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">{p.full_name ?? p.email}</h1>
        <p className="text-sm text-neutral-500">{p.email}</p>
      </div>

      <form action={updateUserSectors} className="max-w-lg space-y-4">
        <input type="hidden" name="user_id" value={p.id} />

        <div>
          <p className="mb-1 block text-sm font-medium text-neutral-700">Setores</p>
          <div className="space-y-1 rounded-md border border-neutral-200 p-3">
            {((sectors ?? []) as Sector[]).map((sector) => (
              <label key={sector.id} className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  name="sector_ids"
                  value={sector.id}
                  defaultChecked={selected.has(sector.id)}
                />
                {sector.name}
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" name="is_admin" defaultChecked={p.is_admin} />
          Administrador (acesso a todos os setores e à gestão de usuários)
        </label>

        <Button type="submit">Salvar alterações</Button>
      </form>
    </div>
  );
}
