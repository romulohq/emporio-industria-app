import Link from "next/link";
import { Layers } from "lucide-react";
import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { loadSubproducts } from "@/lib/recipes/load";
import { ProdutosTabs } from "@/components/products/produtos-tabs";
import { SubproductCreate } from "@/components/recipes/subproduct-forms";

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

      {list.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum subproduto cadastrado ainda.</p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          {list.map((sp, index) => {
            const count = recipes[sp.id]?.lines.length ?? 0;
            return (
              <li key={sp.id} className={index > 0 ? "border-t border-neutral-100" : ""}>
                <Link
                  href={`/produtos/subprodutos/${sp.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-neutral-50"
                >
                  <span className="flex items-center gap-2 font-medium text-neutral-900">
                    <Layers className="h-4 w-4 text-orange-600" />
                    {sp.name}
                    <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-orange-700">
                      SP
                    </span>
                  </span>
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
      )}
    </div>
  );
}
