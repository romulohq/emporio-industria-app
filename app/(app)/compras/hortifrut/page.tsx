import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { fortalezaDateISO } from "@/lib/dates";
import { loadHortifrutiMaterials, loadLatestCounts } from "@/lib/hortifruti/load";
import { HortifrutCountForm, type CountRow } from "@/components/compras/hortifrut-count-form";
import { HortifrutLinkCard } from "@/components/compras/hortifrut-link-card";
import type { HortifrutiCount } from "@/lib/types/database.types";

export default async function ContagemHortifrutPage({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const { profile, sectors } = await requireUser();
  const { data: dateParam } = await searchParams;
  const today = fortalezaDateISO();
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const supabase = await createClient();

  const [materials, { data: dayCounts }, latest, { data: setting }] = await Promise.all([
    loadHortifrutiMaterials(supabase),
    supabase.from("hortifruti_counts").select("*").eq("count_date", date),
    loadLatestCounts(supabase, today),
    // only administrators can read the link code (row-level security)
    profile.is_admin
      ? supabase.from("app_settings").select("value").eq("key", "hortifruti_count_token").maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const countByMaterial = new Map(((dayCounts ?? []) as HortifrutiCount[]).map((c) => [c.raw_material_id, Number(c.quantity)]));
  const rows: CountRow[] = materials.map((m) => ({
    id: m.id,
    name: m.name,
    unit: m.unit,
    quantity: countByMaterial.get(m.id) ?? null,
    lastDate: latest.get(m.id)?.date ?? null,
    lastQuantity: latest.get(m.id)?.quantity ?? null,
  }));

  return (
    <div className="space-y-4">
      {profile.is_admin && <HortifrutLinkCard token={(setting?.value as string | undefined) ?? null} />}
      <HortifrutCountForm key={date} date={date} rows={rows} canEdit={profile.is_admin || sectors.length > 0} />
    </div>
  );
}
