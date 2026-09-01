import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Profile, Sector, UserSector } from "@/lib/types/database.types";

export default async function UsuariosPage() {
  const supabase = await createClient();

  const [{ data: profiles }, { data: links }, { data: sectors }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("user_sectors").select("*"),
    supabase.from("sectors").select("*").order("name"),
  ]);

  const sectorsById = Object.fromEntries(((sectors ?? []) as Sector[]).map((s) => [s.id, s]));
  const sectorsByUser = new Map<string, Sector[]>();
  for (const link of (links ?? []) as UserSector[]) {
    const list = sectorsByUser.get(link.user_id) ?? [];
    const sector = sectorsById[link.sector_id];
    if (sector) list.push(sector);
    sectorsByUser.set(link.user_id, list);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Usuários</h1>
        <Link href="/admin/usuarios/novo">
          <Button>Novo usuário</Button>
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">E-mail</th>
              <th className="px-4 py-2">Perfil</th>
              <th className="px-4 py-2">Setores</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {((profiles ?? []) as Profile[]).map((profile) => (
              <tr key={profile.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-medium text-neutral-900">
                  {profile.full_name ?? "—"}
                </td>
                <td className="px-4 py-2">{profile.email}</td>
                <td className="px-4 py-2">
                  {profile.is_admin ? <Badge tone="blue">Admin</Badge> : <Badge>Setor</Badge>}
                </td>
                <td className="px-4 py-2">
                  {profile.is_admin
                    ? "Todos"
                    : (sectorsByUser.get(profile.id) ?? []).map((s) => s.name).join(", ") || "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/admin/usuarios/${profile.id}`}
                    className="text-amber-700 hover:underline"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
