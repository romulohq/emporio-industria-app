import { requireAdmin } from "@/lib/auth/get-session";
import { CatalogEditor, type PendingProduct } from "@/components/erp/catalog-editor";
import { suggestWeightKg } from "@/lib/erp/analyze";
import { fetchAll, loadCatalog } from "@/lib/erp/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function CadastroProdutosErpPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const catalog = await loadCatalog();
  const known = new Set(catalog.map((c) => c.product_code));

  const orders = await fetchAll<{ product_code: string; erp_description: string; unit_measure: string | null; launch_date: string }>(
    (from, to) =>
      admin
        .from("erp_production_orders")
        .select("product_code, erp_description, unit_measure, launch_date")
        .order("launch_date", { ascending: false })
        .order("id")
        .range(from, to)
  );

  // códigos importados e ainda sem cadastro (vale a descrição da ordem mais recente)
  const pendingByCode = new Map<string, PendingProduct>();
  for (const order of orders) {
    if (known.has(order.product_code) || pendingByCode.has(order.product_code)) continue;
    const unitMeasure = order.unit_measure === "KG" ? "KG" : "UNID";
    pendingByCode.set(order.product_code, {
      code: order.product_code,
      description: order.erp_description,
      unitMeasure,
      suggestedWeightKg: suggestWeightKg(order.erp_description, unitMeasure),
    });
  }
  const pending = [...pendingByCode.values()].sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Produtos ERP</h1>
        <p className="text-sm text-neutral-500">
          Catálogo dos itens do Everest: setor, grupo e peso por unidade (para converter unidades em kg na Produtividade).
        </p>
      </div>
      <CatalogEditor initialItems={catalog} pending={pending} />
    </div>
  );
}
