import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ProductsBrowser } from "@/components/products/products-browser";
import { ProdutosTabs } from "@/components/products/produtos-tabs";
import type { Product, Sector } from "@/lib/types/database.types";

export default async function ProdutosPage() {
  const supabase = await createClient();

  const [{ data: products }, { data: sectors }] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    supabase.from("sectors").select("*").order("name"),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Produtos e fichas técnicas</h1>
        <Link href="/produtos/novo">
          <Button>Novo produto</Button>
        </Link>
      </div>

      <ProdutosTabs />

      <ProductsBrowser products={(products ?? []) as Product[]} sectors={(sectors ?? []) as Sector[]} />
    </div>
  );
}
