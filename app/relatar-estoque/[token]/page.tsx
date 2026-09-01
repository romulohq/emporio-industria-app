import { createAdminClient } from "@/lib/supabase/admin";
import { StockReportForm, type ReportProduct } from "@/components/public/stock-report-form";
import { submitStockReport } from "./actions";

export default async function RelatarEstoquePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: store } = await admin
    .from("stores")
    .select("id, name, active")
    .eq("access_token", token)
    .single();

  if (!store || !store.active) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="max-w-sm rounded-lg border border-neutral-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-neutral-900">Link inválido</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Este link de relato de estoque não é válido ou a loja está inativa. Fale com o
            administrador para receber um novo link.
          </p>
        </div>
      </div>
    );
  }

  const { data: mins } = await admin
    .from("store_product_mins")
    .select("product_id")
    .eq("store_id", store.id);

  const productIds = (mins ?? []).map((m) => m.product_id);

  const { data: products } = productIds.length
    ? await admin.from("products").select("*").in("id", productIds).eq("active", true).order("name")
    : { data: [] };

  const sectorIds = [...new Set((products ?? []).map((p) => p.sector_id))];
  const { data: sectors } = sectorIds.length
    ? await admin.from("sectors").select("id, name").in("id", sectorIds)
    : { data: [] };

  const sectorNameById = Object.fromEntries((sectors ?? []).map((s) => [s.id, s.name]));

  const groupsMap = new Map<string, ReportProduct[]>();
  for (const product of products ?? []) {
    const sectorName = sectorNameById[product.sector_id] ?? "Outros";
    const list = groupsMap.get(sectorName) ?? [];
    list.push({ id: product.id, name: product.name, unit: product.unit });
    groupsMap.set(sectorName, list);
  }
  const groups = [...groupsMap.entries()].map(([sectorName, products]) => ({ sectorName, products }));

  const boundAction = submitStockReport.bind(null, token);

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-8">
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Relatar estoque — {store.name}</h1>
          <p className="text-sm text-neutral-500">
            Informe a quantidade que a loja TEM em estoque agora de cada produto. Não se preocupe
            se está alto ou baixo — o sistema calcula isso automaticamente.
          </p>
        </div>

        {groups.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nenhum produto configurado para esta loja ainda. Fale com o administrador.
          </p>
        ) : (
          <StockReportForm groups={groups} action={boundAction} />
        )}
      </div>
    </div>
  );
}
