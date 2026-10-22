import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { ProductChangesList, type ProductChange } from "@/components/products/product-changes";

export default async function AlteracoesProdutosPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("product_changes").select("*").order("changed_at", { ascending: false }).limit(200);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/produtos" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">
          <ArrowLeft className="h-4 w-4" />
          Produtos
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">Alterações dos produtos</h1>
        <p className="text-sm text-neutral-500">
          Mudanças de setor, de responsável e de situação (ativo ou inativo), com quem fez e quando. Mostra as 200 mais
          recentes.
        </p>
      </div>
      <ProductChangesList changes={(data ?? []) as ProductChange[]} showProduct />
    </div>
  );
}
