import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import type { Product, Sector, SectorResponsible } from "@/lib/types/database.types";

export default async function SetoresPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: sectors }, { data: products }, { data: responsibles }] = await Promise.all([
    supabase.from("sectors").select("*").order("name"),
    supabase.from("products").select("*").eq("active", true),
    supabase.from("sector_responsibles").select("*"),
  ]);

  const sectorsList = (sectors ?? []) as Sector[];
  const productsList = (products ?? []) as Product[];
  const responsiblesList = (responsibles ?? []) as SectorResponsible[];
  const activeResponsibleIds = new Set(responsiblesList.filter((r) => r.active).map((r) => r.id));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Setores</h1>
        <p className="text-sm text-neutral-500">
          Cadastre quem produz o quê em cada setor — isso alimenta a ordem de produção impressa.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {sectorsList.map((sector) => {
          const sectorProducts = productsList.filter((p) => p.sector_id === sector.id);
          const sectorResponsibles = responsiblesList.filter((r) => r.sector_id === sector.id);
          const activeCount = sectorResponsibles.filter((r) => r.active).length;
          const unassignedCount = sectorProducts.filter(
            (p) => !p.responsible_id || !activeResponsibleIds.has(p.responsible_id)
          ).length;

          return (
            <li key={sector.id} className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-sm font-semibold text-neutral-900">{sector.name}</p>
              <dl className="mt-2 space-y-1 text-sm text-neutral-600">
                <div className="flex justify-between">
                  <dt>Produtos no setor</dt>
                  <dd className="font-medium text-neutral-900">{sectorProducts.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Pessoas ativas</dt>
                  <dd className="font-medium text-neutral-900">{activeCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Sem responsável</dt>
                  <dd className="font-medium text-neutral-900">{unassignedCount}</dd>
                </div>
              </dl>
              <Link
                href={`/admin/setores/${sector.id}`}
                className="mt-3 inline-block text-sm font-medium text-orange-700 hover:text-orange-800"
              >
                Gerenciar pessoas →
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
