import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProdutosTabs } from "@/components/products/produtos-tabs";
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
  const groups = sectorList
    .map((s) => ({ sector: s, products: ((products ?? []) as Product[]).filter((p) => p.sector_id === s.id) }))
    .filter((g) => g.products.length > 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-neutral-900">Produtos e fichas técnicas</h1>
      <ProdutosTabs />
      <p className="text-sm text-neutral-500">
        Escolha um produto para montar a ficha técnica: ingredientes, rendimento, modo de preparo e subprodutos (SP).
        Embalagens não têm ficha.
      </p>

      {groups.map(({ sector, products: list }) => (
        <section key={sector.id} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <h2 className="bg-neutral-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {sector.name}
          </h2>
          <ul>
            {list.map((product) => {
              const recipe = recipeByProduct.get(product.id);
              const count = recipe ? (itemCount.get(recipe.id) ?? 0) : 0;
              return (
                <li key={product.id} className="border-t border-neutral-100">
                  <Link
                    href={`/produtos/fichas/${product.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-neutral-50"
                  >
                    <span className="font-medium text-neutral-900">{product.name}</span>
                    {count > 0 ? (
                      <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        {count} {count === 1 ? "ingrediente" : "ingredientes"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-500">Sem ficha</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
