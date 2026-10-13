import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { loadSubproducts } from "@/lib/recipes/load";
import { ProdutosTabs } from "@/components/products/produtos-tabs";
import { SubproductCreate } from "@/components/recipes/subproduct-forms";
import { SubproductsBrowser } from "@/components/recipes/subproducts-browser";

export default async function SubprodutosPage() {
  const { profile, sectors } = await requireUser();
  const supabase = await createClient();
  const { list, recipes } = await loadSubproducts(supabase);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-neutral-900">Produtos e fichas técnicas</h1>
      <ProdutosTabs />
      <p className="text-sm text-neutral-500">
        Subproduto (SP) é um preparo intermediário, como a cebola caramelizada (cebola + óleo refogados). Cada SP tem a
        sua ficha e pode entrar como ingrediente na ficha de um produto ou de outro SP.
      </p>

      <SubproductCreate canEdit={profile.is_admin || sectors.length > 0} />

      <SubproductsBrowser
        items={list.map((sp) => ({ id: sp.id, name: sp.name, ingredients: recipes[sp.id]?.lines.length ?? 0 }))}
      />
    </div>
  );
}
