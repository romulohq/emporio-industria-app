import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { ResponsibleRow } from "@/components/admin/responsible-row";
import { AddResponsibleForm } from "@/components/admin/add-responsible-form";
import { UnassignedProductRow } from "@/components/admin/unassigned-product-row";
import type { Product, Sector, SectorResponsible } from "@/lib/types/database.types";

export default async function SetorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { data: sector } = await supabase.from("sectors").select("*").eq("id", id).single();
  if (!sector) notFound();

  const [{ data: products }, { data: responsibles }] = await Promise.all([
    supabase.from("products").select("*").eq("sector_id", id).eq("active", true).order("name"),
    supabase.from("sector_responsibles").select("*").eq("sector_id", id).order("display_order"),
  ]);

  const productsList = (products ?? []) as Product[];
  const responsiblesList = (responsibles ?? []) as SectorResponsible[];
  const activeResponsibles = responsiblesList.filter((r) => r.active);
  const activeResponsibleIds = new Set(activeResponsibles.map((r) => r.id));

  const countByResponsible = new Map<string, number>();
  const unassigned: Product[] = [];
  for (const product of productsList) {
    if (product.responsible_id && activeResponsibleIds.has(product.responsible_id)) {
      countByResponsible.set(product.responsible_id, (countByResponsible.get(product.responsible_id) ?? 0) + 1);
    } else {
      unassigned.push(product);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/setores" className="text-sm font-medium text-orange-700 hover:text-orange-800">
          ← Setores
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">{(sector as Sector).name}</h1>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-neutral-900">Resumo</h2>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-neutral-500">Total de produtos</p>
            <p className="text-lg font-bold text-neutral-900">{productsList.length}</p>
          </div>
          <div>
            <p className="text-neutral-500">Pessoas ativas</p>
            <p className="text-lg font-bold text-neutral-900">{activeResponsibles.length}</p>
          </div>
          <div>
            <p className="text-neutral-500">Sem responsável</p>
            <p className="text-lg font-bold text-neutral-900">{unassigned.length}</p>
          </div>
        </div>

        {unassigned.length > 0 && (
          <div className="mt-4 border-t border-neutral-100 pt-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Produtos sem responsável
            </p>
            <div className="divide-y divide-neutral-100">
              {unassigned.map((product) => (
                <UnassignedProductRow
                  key={product.id}
                  productId={product.id}
                  productName={product.name}
                  responsibles={activeResponsibles}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Pessoas responsáveis</h2>
          <AddResponsibleForm sectorId={id} />
        </div>

        {responsiblesList.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma pessoa cadastrada ainda neste setor.</p>
        ) : (
          <div className="space-y-2">
            {responsiblesList.map((responsible, index) => (
              <ResponsibleRow
                key={responsible.id}
                responsible={responsible}
                productCount={countByResponsible.get(responsible.id) ?? 0}
                isFirst={index === 0}
                isLast={index === responsiblesList.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
