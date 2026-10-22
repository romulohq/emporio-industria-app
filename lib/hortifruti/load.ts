import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, fortalezaDateISO, weekdayOfISODate } from "@/lib/dates";
import { WEEKDAY_ORDER } from "@/lib/format/labels";
import { weekStartOf } from "@/lib/schedule/week";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { loadRawMaterials, loadSubproducts, toLine } from "@/lib/recipes/load";
import { batchesOfLabel, computeDemand, type DemandProduction, type DemandRecipe } from "@/lib/hortifruti/demand";
import type {
  HortifrutiCount,
  Product,
  RawMaterial,
  Recipe,
  RecipeItem,
  ScheduleCell,
  ScheduleItem,
  ScheduleWeek,
} from "@/lib/types/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Planning window: the 10 days that start tomorrow. */
export const DEMAND_DAYS = 10;

export type HortifrutiMaterial = Pick<RawMaterial, "id" | "name" | "unit">;

export async function loadHortifrutiMaterials(supabase: Supabase): Promise<HortifrutiMaterial[]> {
  const all = await loadRawMaterials(supabase);
  return all.filter((m) => m.category === "hortifruti" && m.active).map((m) => ({ id: m.id, name: m.name, unit: m.unit }));
}

/** Most recent count of each hortifruti raw material (looking back 60 days). */
export async function loadLatestCounts(
  supabase: Supabase,
  today: string
): Promise<Map<string, { quantity: number; date: string }>> {
  const rows = await fetchAll<HortifrutiCount>((from, to) =>
    supabase
      .from("hortifruti_counts")
      .select("*")
      .gte("count_date", addDaysISO(today, -60))
      .order("count_date", { ascending: false })
      .order("raw_material_id")
      .range(from, to)
  );
  const latest = new Map<string, { quantity: number; date: string }>();
  for (const row of rows) {
    if (!latest.has(row.raw_material_id)) latest.set(row.raw_material_id, { quantity: Number(row.quantity), date: row.count_date });
  }
  return latest;
}

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
/** "SOPA DE CARNE CX (12 UND)" -> "sopa de carne": the name a schedule item would use. */
const baseName = (s: string) =>
  normalize(s).replace(/\s*\(.*?\)/g, "").replace(/\s+cx\b.*$/, "").trim();

export type SheetOption = { value: string; label: string };

export type DemandProductionView = DemandProduction & {
  /** name of the technical sheet used, null when none */
  sheetName: string | null;
  linkedBy: "manual" | "auto" | null;
};

export type DemandView = {
  today: string;
  days: string[];
  materials: { id: string; name: string; unit: string; total: number; byDate: Record<string, number> }[];
  productions: DemandProductionView[];
  /** schedule items in the window without a technical sheet, one per item with their dates */
  unlinked: { scheduleItemId: string; name: string; dates: string[] }[];
  sheetOptions: SheetOption[];
  /** Mondays of weeks in the window where the production schedule is still empty */
  emptyWeeks: string[];
  unitMismatches: { name: string; material: string; from: string; to: string }[];
};

/** Hortifruti the productions of the next 10 days will need, read from the schedule and the sheets. */
export async function loadHortifrutiDemand(supabase: Supabase): Promise<DemandView> {
  const today = fortalezaDateISO();
  const days = Array.from({ length: DEMAND_DAYS }, (_, i) => addDaysISO(today, i + 1));
  const weekNumberOf = (date: string) => WEEKDAY_ORDER.indexOf(weekdayOfISODate(date)) + 1; // Monday = 1
  const workdays = days.filter((d) => weekNumberOf(d) <= 5);
  const weekStarts = [...new Set(workdays.map(weekStartOf))];

  const [materials, subproducts, { data: items }, { data: weeks }, { data: cells }, { data: products }, recipes] =
    await Promise.all([
      loadHortifrutiMaterials(supabase),
      loadSubproducts(supabase),
      supabase.from("schedule_items").select("*").eq("active", true),
      weekStarts.length ? supabase.from("schedule_weeks").select("*").in("week_start", weekStarts) : Promise.resolve({ data: [] }),
      weekStarts.length ? supabase.from("schedule_cells").select("*").in("week_start", weekStarts) : Promise.resolve({ data: [] }),
      supabase.from("products").select("id, name, active").eq("active", true).is("converted_to", null),
      loadAllRecipes(supabase),
    ]);

  const itemList = (items ?? []) as ScheduleItem[];
  const itemById = new Map(itemList.map((i) => [i.id, i]));
  const holidaysByWeek = new Map(((weeks ?? []) as ScheduleWeek[]).map((w) => [w.week_start, w.holidays ?? []]));
  const cellList = (cells ?? []) as ScheduleCell[];

  // productions: a "Produzir" / "2x Produzir" cell on a working day that is not a holiday
  const productions: DemandProduction[] = [];
  for (const date of workdays) {
    const weekStart = weekStartOf(date);
    const weekday = weekNumberOf(date);
    if ((holidaysByWeek.get(weekStart) ?? []).includes(weekday)) continue;
    for (const cell of cellList) {
      if (cell.week_start !== weekStart || cell.weekday !== weekday) continue;
      const batches = batchesOfLabel(cell.label);
      const item = itemById.get(cell.item_id);
      if (batches > 0 && item) productions.push({ date, scheduleItemId: item.id, name: item.name, batches });
    }
  }
  const emptyWeeks = weekStarts.filter((w) => !cellList.some((c) => c.week_start === w));

  // which technical sheet each schedule item reads: the one linked by hand, else the same name
  const productList = (products ?? []) as Pick<Product, "id" | "name">[];
  const sheetOf = (key: string) => recipes.get(key);
  const candidates: { key: string; name: string }[] = [
    ...productList.filter((p) => sheetOf(`p:${p.id}`)?.length).map((p) => ({ key: `p:${p.id}`, name: p.name })),
    ...subproducts.list
      .filter((s) => s.active && (subproducts.recipes[s.id]?.lines.length ?? 0) > 0)
      .map((s) => ({ key: `s:${s.id}`, name: s.name })),
  ];
  const nameOfKey = new Map(candidates.map((c) => [c.key, c.name]));

  const linkOf = new Map<string, { key: string; by: "manual" | "auto" } | null>();
  for (const id of new Set(productions.map((p) => p.scheduleItemId))) {
    const item = itemById.get(id)!;
    const manual = item.recipe_product_id ? `p:${item.recipe_product_id}` : item.recipe_subproduct_id ? `s:${item.recipe_subproduct_id}` : null;
    if (manual && nameOfKey.has(manual)) {
      linkOf.set(id, { key: manual, by: "manual" });
      continue;
    }
    const exact = candidates.find((c) => normalize(c.name) === normalize(item.name));
    const loose = candidates.find((c) => baseName(c.name) === baseName(item.name));
    const match = exact ?? loose;
    linkOf.set(id, match ? { key: match.key, by: "auto" } : null);
  }

  const recipeByItem = new Map<string, DemandRecipe | undefined>();
  for (const [itemId, link] of linkOf) {
    if (!link) continue;
    const lines = link.key.startsWith("p:")
      ? sheetOf(link.key)
      : subproducts.recipes[link.key.slice(2)]?.lines;
    if (lines) recipeByItem.set(itemId, { lines });
  }

  const result = computeDemand({
    productions,
    recipeByItem,
    subproducts: subproducts.recipes,
    hortifruti: new Map(materials.map((m) => [m.id, m.unit])),
  });

  const productionViews: DemandProductionView[] = productions
    .map((p) => {
      const link = linkOf.get(p.scheduleItemId) ?? null;
      return { ...p, sheetName: link ? (nameOfKey.get(link.key) ?? null) : null, linkedBy: link?.by ?? null };
    })
    .sort((a, b) => (a.date === b.date ? a.name.localeCompare(b.name) : a.date < b.date ? -1 : 1));

  const unlinkedById = new Map<string, { scheduleItemId: string; name: string; dates: string[] }>();
  for (const p of result.withoutRecipe) {
    const entry = unlinkedById.get(p.scheduleItemId) ?? { scheduleItemId: p.scheduleItemId, name: p.name, dates: [] };
    entry.dates.push(p.date);
    unlinkedById.set(p.scheduleItemId, entry);
  }

  return {
    today,
    days,
    materials: materials
      .map((m) => {
        const demand = result.byMaterial.get(m.id);
        return { ...m, total: demand?.total ?? 0, byDate: Object.fromEntries(demand?.byDate ?? []) };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
    productions: productionViews,
    unlinked: [...unlinkedById.values()].sort((a, b) => a.name.localeCompare(b.name)),
    sheetOptions: candidates.map((c) => ({ value: c.key, label: c.key.startsWith("s:") ? `${c.name} (SP)` : c.name })).sort((a, b) => a.label.localeCompare(b.label)),
    emptyWeeks,
    unitMismatches: result.unitMismatches.map((m) => ({
      name: itemById.get(m.scheduleItemId)?.name ?? "—",
      material: m.material,
      from: m.from,
      to: m.to,
    })),
  };
}

/** Lines of every product's technical sheet, keyed "p:<product id>" (subproducts come from loadSubproducts). */
async function loadAllRecipes(supabase: Supabase): Promise<Map<string, ReturnType<typeof toLine>[]>> {
  const [{ data: recipes }, rawMaterials] = await Promise.all([
    supabase.from("recipes").select("*").not("product_id", "is", null),
    loadRawMaterials(supabase),
  ]);
  const recipeRows = (recipes ?? []) as Recipe[];
  if (recipeRows.length === 0) return new Map();
  const items = await fetchAll<RecipeItem>((from, to) =>
    supabase.from("recipe_items").select("*").order("recipe_id").order("position").range(from, to)
  );
  const rawNames = new Map(rawMaterials.map((m) => [m.id, m.name]));
  const productByRecipe = new Map(recipeRows.map((r) => [r.id, r.product_id as string]));
  const out = new Map<string, ReturnType<typeof toLine>[]>();
  for (const item of items) {
    const productId = productByRecipe.get(item.recipe_id);
    if (!productId) continue;
    const key = `p:${productId}`;
    out.set(key, [...(out.get(key) ?? []), toLine(item, rawNames)]);
  }
  return out;
}
