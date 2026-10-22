import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-session";
import { ProductChangesList, type ProductChange } from "@/components/products/product-changes";
import { ProductForm } from "@/components/products/product-form";
import { updateProduct, toggleProductActive } from "@/app/(app)/produtos/actions";
import type { Product, ProductionUnit, Sector } from "@/lib/types/database.types";

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await requireUser();
  const supabase = await createClient();

  const [{ data: product }, { data: sectors }, { data: units }, { data: changes }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase.from("sectors").select("*").order("name"),
    supabase.from("production_units").select("*"),
    // only administrators can read the change log (row-level security)
    profile.is_admin
      ? supabase.from("product_changes").select("*").eq("product_id", id).order("changed_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: [] as ProductChange[] }),
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
        unitNames={Object.fromEntries(((units ?? []) as ProductionUnit[]).map((u) => [u.id, u.name]))}
        product={product as Product}
        action={updateProduct}
      />

      {profile.is_admin && (
        <section className="max-w-3xl space-y-2">
          <h2 className="text-sm font-semibold text-neutral-900">Histórico de alterações</h2>
          <ProductChangesList changes={(changes ?? []) as ProductChange[]} />
        </section>
      )}
    </div>
  );
}
