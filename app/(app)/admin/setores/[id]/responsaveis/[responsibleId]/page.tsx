import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import {
  ResponsibleProductsChecklist,
  type ChecklistProduct,
} from "@/components/admin/responsible-products-checklist";
import type { Product, Sector, SectorResponsible } from "@/lib/types/database.types";

export default async function ResponsibleProductsPage({
  params,
}: {
  params: Promise<{ id: string; responsibleId: string }>;
}) {
  await requireAdmin();
  const { id: sectorId, responsibleId } = await params;
  const supabase = await createClient();

  const [{ data: sector }, { data: responsible }] = await Promise.all([
    supabase.from("sectors").select("*").eq("id", sectorId).single(),
    supabase.from("sector_responsibles").select("*").eq("id", responsibleId).single(),
  ]);
  if (!sector || !responsible) notFound();

  // products of every sector of the same production unit: ticking one from another sector moves it here
  const unitId = (sector as Sector).unit_id;
  const { data: unitSectors } = unitId
    ? await supabase.from("sectors").select("*").eq("unit_id", unitId)
    : { data: [sector] as Sector[] };
  const sectorList = (unitSectors ?? []) as Sector[];
  const sectorNameById = Object.fromEntries(sectorList.map((s) => [s.id, s.name]));
  const sectorIds = sectorList.map((s) => s.id);

  const [{ data: products }, { data: responsibles }] = await Promise.all([
    supabase.from("products").select("*").in("sector_id", sectorIds).eq("active", true).is("converted_to", null).order("name"),
    supabase.from("sector_responsibles").select("*").in("sector_id", sectorIds),
  ]);

  const responsiblesById = Object.fromEntries(
    ((responsibles ?? []) as SectorResponsible[]).map((r) => [r.id, r])
  );

  const checklistProducts: ChecklistProduct[] = ((products ?? []) as Product[]).map((p) => ({
    id: p.id,
    name: p.name,
    ownerId: p.responsible_id,
    ownerName: p.responsible_id ? (responsiblesById[p.responsible_id]?.person_name ?? "outra pessoa") : null,
    sectorId: p.sector_id,
    sectorName: sectorNameById[p.sector_id] ?? "—",
  }));

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/admin/setores/${sectorId}`}
          className="text-sm font-medium text-orange-700 hover:text-orange-800"
        >
          ← {(sector as Sector).name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">
          {(responsible as SectorResponsible).role_name} — {(responsible as SectorResponsible).person_name}
        </h1>
        <p className="text-sm text-neutral-500">
          Marque os produtos que são desta pessoa. Produtos de outra pessoa mostram o nome dela ao lado. Os de
          outros setores ficam numa lista à parte: marcar um deles o <b>move para este setor</b>.
        </p>
      </div>

      <ResponsibleProductsChecklist
        sectorId={sectorId}
        responsibleId={responsibleId}
        responsibleName={(responsible as SectorResponsible).person_name}
        products={checklistProducts}
      />
    </div>
  );
}
