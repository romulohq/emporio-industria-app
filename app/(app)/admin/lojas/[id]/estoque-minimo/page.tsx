import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveStoreProductMins } from "@/app/(app)/admin/lojas/actions";
import type { Product, Sector, Store, StoreProductMin } from "@/lib/types/database.types";

export default async function EstoqueMinimoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: store } = await supabase.from("stores").select("*").eq("id", id).single();
  if (!store) notFound();

  const { data: unit } = await supabase
    .from("production_units")
    .select("id")
    .eq("slug", "rui-barbosa")
    .single();

  const { data: sectors } = await supabase
    .from("sectors")
    .select("*")
    .eq("unit_id", unit?.id ?? "")
    .order("name");

  const sectorIds = ((sectors ?? []) as Sector[]).map((s) => s.id);

  const [{ data: products }, { data: mins }] = await Promise.all([
    sectorIds.length
      ? supabase.from("products").select("*").in("sector_id", sectorIds).eq("active", true).order("name")
      : Promise.resolve({ data: [] as Product[] }),
    supabase.from("store_product_mins").select("*").eq("store_id", id),
  ]);

  const sectorsById = Object.fromEntries(((sectors ?? []) as Sector[]).map((s) => [s.id, s]));
  const minsByProduct = Object.fromEntries(
    ((mins ?? []) as StoreProductMin[]).map((m) => [m.product_id, m.min_quantity])
  );

  const grouped = new Map<string, Product[]>();
  for (const product of (products ?? []) as Product[]) {
    const list = grouped.get(product.sector_id) ?? [];
    list.push(product);
    grouped.set(product.sector_id, list);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">
          Estoque mínimo — {(store as Store).name}
        </h1>
        <p className="text-sm text-neutral-500">
          Definido só pelo admin. A loja não vê esses valores no formulário de relato.
        </p>
      </div>

      <form action={saveStoreProductMins} className="space-y-6">
        <input type="hidden" name="store_id" value={id} />

        {[...grouped.entries()].map(([sectorId, items]) => (
          <div key={sectorId} className="rounded-lg border border-neutral-200 bg-white">
            <div className="border-b border-neutral-100 px-4 py-3 font-semibold text-neutral-900">
              {sectorsById[sectorId]?.name}
            </div>
            <div className="divide-y divide-neutral-100">
              {items.map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-4 px-4 py-2">
                  <span className="text-sm text-neutral-800">{product.name}</span>
                  <Input
                    type="number"
                    step="0.001"
                    min={0}
                    name={`min_${product.id}`}
                    defaultValue={minsByProduct[product.id] ?? 0}
                    className="w-28"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {grouped.size === 0 && (
          <p className="text-sm text-neutral-500">
            Nenhum produto cadastrado ainda nos setores Pão/Confeitaria da Unidade Rui Barbosa.
          </p>
        )}

        <Button type="submit">Salvar estoque mínimo</Button>
      </form>
    </div>
  );
}
