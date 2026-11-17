import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAll, loadCatalog } from "@/lib/erp/queries";
import { isConcluded } from "@/lib/erp/analyze";
import { manualEntriesToCount } from "@/lib/erp/manual-production";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ErpProductionOrder, ManualProduction } from "@/lib/types/database.types";

export const runtime = "nodejs";

type Row = Pick<ErpProductionOrder, "order_number" | "product_code" | "erp_description" | "launch_date" | "quantity" | "status" | "excluded">;

/**
 * Ordens importadas do ERP para a aba Produtividade (qualquer usuário logado enxerga a aba, mas a tabela
 * é restrita a admins — por isso a leitura usa o cliente de serviço depois de checar a sessão).
 * Só quantidades: custo e notas não saem daqui. Entram também as produções lançadas à mão ("Inserir
 * produção"), exceto onde o ERP já trouxe o mesmo produto no mesmo dia.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });

  const admin = createAdminClient();
  const [rows, catalog, manualRows] = await Promise.all([
    fetchAll<Row>((from, to) =>
      admin
        .from("erp_production_orders")
        .select("order_number, product_code, erp_description, launch_date, quantity, status, excluded")
        .order("launch_date")
        .order("order_number")
        .range(from, to)
    ),
    loadCatalog(),
    fetchAll<ManualProduction>((from, to) =>
      admin.from("manual_productions").select("*").order("seq").range(from, to)
    ),
  ]);

  const names = new Map(catalog.map((c) => [c.product_code, c]));
  const manual = manualEntriesToCount(
    manualRows
      .filter((m) => names.has(m.product_code))
      .map((m) => ({ productCode: m.product_code, date: m.production_date, quantity: Number(m.quantity), seq: m.seq })),
    rows
  );

  const products: Record<string, { n: string; d: string; um: string; s: string; g: string; f: number }> = {};
  const describe = (code: string, erpDescription: string) => {
    if (products[code]) return;
    const item = names.get(code);
    products[code] = {
      n: item?.display_name ?? erpDescription,
      d: erpDescription,
      um: item?.unit_measure ?? "UNID",
      s: item?.sector ?? "Cozinha",
      g: item?.group_name ?? "Outros",
      f: 0,
    };
  };
  for (const row of rows) describe(row.product_code, row.erp_description);
  for (const m of manual) describe(m.productCode, names.get(m.productCode)?.display_name ?? m.productCode);

  return NextResponse.json(
    {
      products,
      weights: Object.fromEntries(catalog.filter((c) => c.unit_weight_kg != null).map((c) => [c.product_code, Number(c.unit_weight_kg)])),
      orders: [
        ...rows.map((r) => ({
          c: r.product_code,
          d: r.launch_date,
          q: Number(r.quantity),
          o: r.order_number,
          a: isConcluded(r.status) ? 0 : 1,
          x: r.excluded ? 1 : 0,
        })),
        // número negativo: nunca colide com o de uma ordem do ERP (o painel usa o número para não repetir ordens)
        ...manual.map((m) => ({ c: m.productCode, d: m.date, q: m.quantity, o: -m.seq, a: 0, x: 0 })),
      ],
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
