import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/products/product-form";
import { updateProduct, toggleProductActive } from "@/app/(app)/produtos/actions";
import type { Product, Sector } from "@/lib/types/database.types";

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: product }, { data: sectors }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase.from("sectors").select("*").order("name"),
  ]);

  if (!product) notFound();

  const toggleActive = async () => {
    "use server";
    await toggleProductActive(product.id, !product.active);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Editar produto</h1>
        <form action={toggleActive}>
          <button type="submit" className="text-sm text-neutral-500 underline hover:text-neutral-800">
            {product.active ? "Desativar produto" : "Reativar produto"}
          </button>
        </form>
      </div>

      <ProductForm
        sectors={(sectors ?? []) as Sector[]}
        product={product as Product}
        action={updateProduct}
      />
    </div>
  );
}
