import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ProductTable } from "@/components/products/product-table";
import { ProdutosTabs } from "@/components/products/produtos-tabs";
import { cn } from "@/lib/utils";
import type { Product, Sector } from "@/lib/types/database.types";

export default async function ProdutosPage({ searchParams }: { searchParams: Promise<{ setor?: string }> }) {
  const { setor } = await searchParams;
  const supabase = await createClient();

  const [{ data: products }, { data: sectors }] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    supabase.from("sectors").select("*").order("name"),
  ]);

  const all = (products ?? []) as Product[];
  const sectorList = (sectors ?? []) as Sector[];
  const sectorsById = Object.fromEntries(sectorList.map((s) => [s.id, s]));

  // classification chips: only the sectors that have products, with how many each
  const counts = new Map<string, number>();
  for (const p of all) counts.set(p.sector_id, (counts.get(p.sector_id) ?? 0) + 1);
  const chips = sectorList.filter((s) => counts.has(s.id));
  const selected = chips.find((s) => s.id === setor);
  const visible = selected ? all.filter((p) => p.sector_id === selected.id) : all;

  const chipClass = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs font-medium",
      active
        ? "border-orange-600 bg-orange-50 text-orange-700"
        : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Produtos e fichas técnicas</h1>
        <Link href="/produtos/novo">
          <Button>Novo produto</Button>
        </Link>
      </div>

      <ProdutosTabs />

      <div className="flex flex-wrap gap-2">
        <Link href="/produtos" className={chipClass(!selected)}>
          Todos · {all.length}
        </Link>
        {chips.map((s) => (
          <Link key={s.id} href={`/produtos?setor=${s.id}`} className={chipClass(selected?.id === s.id)}>
            {s.name} · {counts.get(s.id)}
          </Link>
        ))}
      </div>

      <ProductTable products={visible} sectorsById={sectorsById} />
    </div>
  );
}
