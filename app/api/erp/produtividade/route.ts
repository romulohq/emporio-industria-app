import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAll, loadCatalog } from "@/lib/erp/queries";
import { isConcluded } from "@/lib/erp/analyze";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ErpProductionOrder } from "@/lib/types/database.types";

export const runtime = "nodejs";

type Row = Pick<ErpProductionOrder, "order_number" | "product_code" | "erp_description" | "launch_date" | "quantity" | "status" | "excluded">;

/**
 * Ordens importadas do ERP para a aba Produtividade (qualquer usuário logado enxerga a aba, mas a tabela
 * é restrita a admins — por isso a leitura usa o cliente de serviço depois de checar a sessão).
 * Só quantidades: custo e notas não saem daqui.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });

  const admin = createAdminClient();
  const [rows, catalog] = await Promise.all([
    fetchAll<Row>((from, to) =>
      admin
        .from("erp_production_orders")
        .select("order_number, product_code, erp_description, launch_date, quantity, status, excluded")
        .order("launch_date")
        .order("order_number")
        .range(from, to)
    ),
    loadCatalog(),
  ]);

  const names = new Map(catalog.map((c) => [c.product_code, c]));
  const products: Record<string, { n: string; d: string; um: string; s: string; g: string; f: number }> = {};
  for (const row of rows) {
    if (products[row.product_code]) continue;
    const item = names.get(row.product_code);
    products[row.product_code] = {
      n: item?.display_name ?? row.erp_description,
      d: row.erp_description,
      um: item?.unit_measure ?? "UNID",
      s: item?.sector ?? "Cozinha",
      g: item?.group_name ?? "Outros",
      f: 0,
    };
  }

  return NextResponse.json(
    {
      products,
      weights: Object.fromEntries(catalog.filter((c) => c.unit_weight_kg != null).map((c) => [c.product_code, Number(c.unit_weight_kg)])),
      orders: rows.map((r) => ({
        c: r.product_code,
        d: r.launch_date,
        q: Number(r.quantity),
        o: r.order_number,
        a: isConcluded(r.status) ? 0 : 1,
        x: r.excluded ? 1 : 0,
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
