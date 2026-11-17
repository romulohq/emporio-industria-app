import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadCatalog, fetchAll } from "@/lib/erp/queries";
import { suggestProductCode, type ProductionDayData, type ProductionDayItem } from "@/lib/erp/manual-production";
import { weekdayOfISODate } from "@/lib/dates";
import { WEEKDAY_ORDER } from "@/lib/format/labels";
import { weekStartOf } from "@/lib/schedule/week";
import { batchesOfLabel } from "@/lib/hortifruti/demand";
import type { Database, ErpProductionOrder, ManualProduction, ScheduleCell, ScheduleItem } from "@/lib/types/database.types";

const SECTION_ORDER = ["salgados", "folheados", "paes", "cozinha"];

/** What the schedule has for one day, plus what was already typed and what the ERP already brought. */
export async function loadProductionDay(supabase: SupabaseClient<Database>, date: string): Promise<ProductionDayData> {
  const weekNumber = WEEKDAY_ORDER.indexOf(weekdayOfISODate(date)) + 1; // Monday = 1
  const weekend = weekNumber > 5;
  const admin = createAdminClient();

  const [catalog, manualRes, erpRows, itemsRes, cellsRes] = await Promise.all([
    loadCatalog(),
    supabase.from("manual_productions").select("*").eq("production_date", date),
    fetchAll<Pick<ErpProductionOrder, "product_code" | "quantity" | "excluded">>((from, to) =>
      admin
        .from("erp_production_orders")
        .select("product_code, quantity, excluded")
        .eq("launch_date", date)
        .order("order_number")
        .range(from, to)
    ),
    supabase.from("schedule_items").select("*").eq("active", true).order("position"),
    weekend
      ? Promise.resolve({ data: [] as ScheduleCell[] })
      : supabase.from("schedule_cells").select("*").eq("week_start", weekStartOf(date)).eq("weekday", weekNumber),
  ]);

  const manual = (manualRes.data ?? []) as ManualProduction[];
  const cellByItem = new Map(((cellsRes.data ?? []) as ScheduleCell[]).map((c) => [c.item_id, c.label]));
  const items = ((itemsRes.data ?? []) as ScheduleItem[])
    .filter((i) => cellByItem.has(i.id))
    .sort((a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section) || a.position - b.position);

  const known = new Set(catalog.map((c) => c.product_code));
  const manualByCode = new Map(manual.map((m) => [m.product_code, Number(m.quantity)]));
  const used = new Set<string>();

  const lines: ProductionDayItem[] = items.map((item) => {
    const label = cellByItem.get(item.id) ?? "";
    const fromEntry = manual.find((m) => m.schedule_item_id === item.id && known.has(m.product_code))?.product_code ?? null;
    const confirmed = item.erp_product_code && known.has(item.erp_product_code) ? item.erp_product_code : fromEntry;
    const guess = confirmed ? null : suggestProductCode(item.name, catalog);
    const productCode = confirmed ?? guess;
    return {
      scheduleItemId: item.id,
      name: item.name,
      label,
      producing: batchesOfLabel(label) > 0,
      productCode,
      suggested: !confirmed && guess !== null,
      quantity: productCode ? (manualByCode.get(productCode) ?? null) : null,
    };
  });

  // two schedule lines never share a product: the later one waits for the person to choose
  for (const line of lines) {
    if (!line.productCode) continue;
    if (used.has(line.productCode)) {
      line.productCode = null;
      line.suggested = false;
      line.quantity = null;
    } else {
      used.add(line.productCode);
    }
  }

  const erp: Record<string, number> = {};
  for (const row of erpRows) if (!row.excluded) erp[row.product_code] = (erp[row.product_code] ?? 0) + Number(row.quantity);

  return {
    date,
    weekend,
    items: lines,
    extras: manual.filter((m) => !used.has(m.product_code)).map((m) => ({ productCode: m.product_code, quantity: Number(m.quantity) })),
    erp,
  };
}
