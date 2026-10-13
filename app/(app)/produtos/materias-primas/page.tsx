import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { loadRawMaterials } from "@/lib/recipes/load";
import { ProdutosTabs } from "@/components/products/produtos-tabs";
import { RawMaterialsManager } from "@/components/recipes/raw-materials-manager";

export default async function MateriasPrimasPage() {
  const { profile, sectors } = await requireUser();
  const supabase = await createClient();

  const [materials, { data: usage }] = await Promise.all([
    loadRawMaterials(supabase),
    supabase.from("recipe_items").select("raw_material_id, recipe_id").not("raw_material_id", "is", null),
  ]);

  // in how many sheets (recipes) each raw material appears
  const recipesByMaterial = new Map<string, Set<string>>();
  for (const row of (usage ?? []) as { raw_material_id: string; recipe_id: string }[]) {
    const set = recipesByMaterial.get(row.raw_material_id) ?? new Set<string>();
    set.add(row.recipe_id);
    recipesByMaterial.set(row.raw_material_id, set);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-neutral-900">Produtos e fichas técnicas</h1>
      <ProdutosTabs />
      <p className="text-sm text-neutral-500">
        Cadastre aqui os insumos usados na fábrica. Eles são escolhidos como ingredientes nas fichas técnicas dos
        produtos e dos subprodutos.
      </p>

      <RawMaterialsManager
        items={materials.map((m) => ({
          id: m.id,
          name: m.name,
          unit: m.unit,
          code: m.code,
          uses: recipesByMaterial.get(m.id)?.size ?? 0,
        }))}
        canEdit={profile.is_admin || sectors.length > 0}
      />
    </div>
  );
}
