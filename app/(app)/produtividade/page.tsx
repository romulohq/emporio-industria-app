import { requireUser } from "@/lib/auth/get-session";
import { loadCatalog } from "@/lib/erp/queries";
import { fortalezaDateISO } from "@/lib/dates";
import { ProductivityFrame } from "@/components/productivity/productivity-frame";

export default async function ProdutividadePage() {
  await requireUser();
  const catalog = (await loadCatalog())
    .filter((c) => c.active)
    .map((c) => ({ code: c.product_code, name: c.display_name, unit: c.unit_measure ?? "UNID", sector: c.sector }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return <ProductivityFrame today={fortalezaDateISO()} catalog={catalog} />;
}
