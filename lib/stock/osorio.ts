import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Product, Sector } from "@/lib/types/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Sectors and active products of the Fábrica Osório de Paiva — the only unit the stock control covers. */
export async function getOsorioCatalog(supabase: Supabase): Promise<{ sectors: Sector[]; products: Product[] }> {
  const { data: unit } = await supabase.from("production_units").select("id").eq("slug", "osorio-de-paiva").single();
  if (!unit) return { sectors: [], products: [] };

  const { data: sectors } = await supabase.from("sectors").select("*").eq("unit_id", unit.id).order("name");
  const sectorList = (sectors ?? []) as Sector[];
  if (sectorList.length === 0) return { sectors: [], products: [] };

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .in("sector_id", sectorList.map((s) => s.id))
    .eq("active", true)
    .order("name");
  return { sectors: sectorList, products: (products ?? []) as Product[] };
}
