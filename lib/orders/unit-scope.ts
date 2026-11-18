import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";
import type { OrdersContext } from "@/lib/orders/units";

export type UnitScope = {
  unitId: string | null;
  /** setores da unidade: as ordens de produtos deles pertencem a esta frente */
  sectorIds: Set<string>;
  /** lojas das rotas da unidade */
  storeIds: Set<string>;
};

/** Setores e lojas de uma unidade (loja -> rota -> unidade), para cada tela mostrar só o que é da sua frente. */
export async function loadUnitScope(supabase: SupabaseClient<Database>, ctx: OrdersContext): Promise<UnitScope> {
  const { data: unit } = await supabase.from("production_units").select("id").eq("slug", ctx.unitSlug).maybeSingle();
  if (!unit) return { unitId: null, sectorIds: new Set(), storeIds: new Set() };

  const [{ data: sectors }, { data: routes }] = await Promise.all([
    supabase.from("sectors").select("id").eq("unit_id", unit.id),
    supabase.from("delivery_routes").select("id").eq("unit_id", unit.id),
  ]);
  const routeIds = (routes ?? []).map((r) => r.id as string);
  const { data: stores } = routeIds.length
    ? await supabase.from("stores").select("id").in("route_id", routeIds)
    : { data: [] as { id: string }[] };

  return {
    unitId: unit.id as string,
    sectorIds: new Set((sectors ?? []).map((s) => s.id as string)),
    storeIds: new Set((stores ?? []).map((s) => s.id as string)),
  };
}
