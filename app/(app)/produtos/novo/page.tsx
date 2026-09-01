import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/products/product-form";
import { createProduct } from "@/app/(app)/produtos/actions";
import type { Sector } from "@/lib/types/database.types";

export default async function NovoProdutoPage() {
  const supabase = await createClient();
  const { data: sectors } = await supabase.from("sectors").select("*").order("name");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-neutral-900">Novo produto</h1>
      <ProductForm sectors={(sectors ?? []) as Sector[]} action={createProduct} />
    </div>
  );
}
