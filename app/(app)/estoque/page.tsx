import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-session";
import { EstoqueTabs } from "@/components/stock/estoque-tabs";
import { StockCountForm, type CountRow } from "@/components/stock/stock-count-form";
import { getOsorioCatalog } from "@/lib/stock/osorio";
import { fortalezaDateISO } from "@/lib/dates";

export default async function ContagemDoDiaPage({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const { data: dateParam } = await searchParams;
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : fortalezaDateISO();

  const { profile, sectors: mySectors } = await requireUser();
  const supabase = await createClient();
  const { sectors, products } = await getOsorioCatalog(supabase);
  const osorioSectorIds = new Set(sectors.map((s) => s.id));
  const canEdit = profile.is_admin || mySectors.some((s) => osorioSectorIds.has(s.id));

  const { data: counts } = products.length
    ? await supabase
        .from("stock_counts")
        .select("product_id, boxes")
        .eq("count_date", date)
        .in("product_id", products.map((p) => p.id))
    : { data: [] as { product_id: string; boxes: number }[] };
  const boxesByProduct = new Map((counts ?? []).map((c) => [c.product_id as string, Number(c.boxes)]));

  const groups = sectors
    .map((sector) => ({
      sectorName: sector.name,
      rows: products
        .filter((p) => p.sector_id === sector.id)
        .map<CountRow>((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          min: Number(p.min_quantity),
          unitsPerBox: Number(p.units_per_box),
          boxes: boxesByProduct.get(p.id) ?? null,
        })),
    }))
    .filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <h1 className="text-xl font-semibold text-neutral-900">Estoque</h1>
        <p className="text-sm text-neutral-500">
          Contagem da câmara — Fábrica Osório de Paiva. Informe as caixas contadas; o estoque em unidades e o
          nível de abastecimento do mínimo são calculados na hora.
        </p>
      </div>

      <EstoqueTabs />

      {groups.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum produto cadastrado na Fábrica Osório de Paiva ainda.</p>
      ) : (
        <StockCountForm key={date} date={date} groups={groups} canEdit={canEdit} />
      )}
    </div>
  );
}
