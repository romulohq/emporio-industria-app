import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ProductTable } from "@/components/products/product-table";
import type { Product, Sector } from "@/lib/types/database.types";

export default async function ProdutosPage() {
  const supabase = await createClient();

  const [{ data: products }, { data: sectors }] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    supabase.from("sectors").select("*").order("name"),
  ]);

  const sectorsById = Object.fromEntries(((sectors ?? []) as Sector[]).map((s) => [s.id, s]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Produtos</h1>
        <Link href="/produtos/novo">
          <Button>Novo produto</Button>
        </Link>
      </div>

      <ProductTable products={(products ?? []) as Product[]} sectorsById={sectorsById} />
    </div>
  );
}
