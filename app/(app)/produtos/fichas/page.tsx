import { createClient } from "@/lib/supabase/server";
import { ProdutosTabs } from "@/components/products/produtos-tabs";
import { FichasBrowser, type FichaGroup } from "@/components/recipes/fichas-browser";
import type { Product, Recipe, Sector } from "@/lib/types/database.types";

export default async function FichasPage() {
  const supabase = await createClient();

  const [{ data: products }, { data: sectors }, { data: recipes }, { data: items }] = await Promise.all([
    supabase.from("products").select("*").eq("active", true).order("name"),
    supabase.from("sectors").select("*").order("name"),
    supabase.from("recipes").select("*").not("product_id", "is", null),
    supabase.from("recipe_items").select("recipe_id"),
  ]);

  const recipeByProduct = new Map(((recipes ?? []) as Recipe[]).map((r) => [r.product_id as string, r]));
  const itemCount = new Map<string, number>();
  for (const i of (items ?? []) as { recipe_id: string }[]) itemCount.set(i.recipe_id, (itemCount.get(i.recipe_id) ?? 0) + 1);

  // packaging does not have a technical sheet
  const sectorList = ((sectors ?? []) as Sector[]).filter((s) => !/embalage/i.test(s.name));
  const groups: FichaGroup[] = sectorList
    .map((s) => ({
      sectorId: s.id,
      sectorName: s.name,
      products: ((products ?? []) as Product[])
        .filter((p) => p.sector_id === s.id)
        .map((p) => {
          const recipe = recipeByProduct.get(p.id);
          return { id: p.id, name: p.name, ingredients: recipe ? (itemCount.get(recipe.id) ?? 0) : 0 };
        }),
    }))
    .filter((g) => g.products.length > 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-neutral-900">Produtos e fichas técnicas</h1>
      <ProdutosTabs />
      <p className="text-sm text-neutral-500">
        Escolha um produto para montar a ficha técnica: ingredientes, rendimento, modo de preparo e subprodutos (SP).
        Embalagens não têm ficha.
      </p>

      <FichasBrowser groups={groups} />
    </div>
  );
}
