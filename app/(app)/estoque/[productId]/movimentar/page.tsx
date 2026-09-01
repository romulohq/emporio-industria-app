import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MovementForm } from "@/components/stock/movement-form";
import { formatQuantity } from "@/lib/format/labels";
import type { Product } from "@/lib/types/database.types";

export default async function MovimentarEstoquePage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .single();

  if (!product) notFound();

  const p = product as Product;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Movimentar estoque</h1>
        <p className="text-sm text-neutral-500">
          {p.name} — saldo atual: {formatQuantity(p.current_quantity, p.unit)}
        </p>
      </div>

      <MovementForm product={p} />
    </div>
  );
}
