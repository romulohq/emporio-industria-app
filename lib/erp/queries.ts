import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AnalysisContext, CatalogInfo, ExistingOrder, HistoryOrder } from "@/lib/erp/analyze";
import { orderKey, type ErpOrderRow } from "@/lib/erp/types";
import type { ErpProductCatalogItem, ErpProductionOrder } from "@/lib/types/database.types";

const PAGE = 1000;

/** O PostgREST corta cada resposta em 1.000 linhas: lê todas as páginas, senão ordens somem em silêncio. */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export async function loadCatalog(): Promise<ErpProductCatalogItem[]> {
  const admin = createAdminClient();
  return fetchAll<ErpProductCatalogItem>((from, to) =>
    admin.from("erp_product_catalog").select("*").order("product_code").range(from, to)
  );
}

/** Tudo que a prévia e a importação precisam saber do banco para analisar as linhas do arquivo. */
export async function loadAnalysisContext(rows: ErpOrderRow[]): Promise<AnalysisContext> {
  const admin = createAdminClient();
  const codes = [...new Set(rows.map((r) => r.productCode))];

  const catalogRows = await loadCatalog();
  const catalog = new Map<string, CatalogInfo>(
    catalogRows.map((c) => [c.product_code, { unitWeightKg: c.unit_weight_kg, unitMeasure: c.unit_measure }])
  );

  const history: HistoryOrder[] = [];
  for (const part of chunk(codes, 100)) {
    const found = await fetchAll<Pick<ErpProductionOrder, "unit" | "order_number" | "product_code" | "quantity">>(
      (from, to) =>
        admin
          .from("erp_production_orders")
          .select("unit, order_number, product_code, quantity")
          .in("product_code", part)
          .eq("excluded", false)
          .order("id")
          .range(from, to)
    );
    for (const o of found) {
      history.push({ key: `${o.unit}#${o.order_number}`, productCode: o.product_code, quantity: Number(o.quantity) });
    }
  }

  const existing = new Map<string, ExistingOrder>();
  const byUnit = new Map<string, number[]>();
  for (const row of rows) byUnit.set(row.unit, [...(byUnit.get(row.unit) ?? []), row.orderNumber]);
  for (const [unit, numbers] of byUnit) {
    for (const part of chunk(numbers, 200)) {
      const found = await fetchAll<ErpProductionOrder>((from, to) =>
        admin.from("erp_production_orders").select("*").eq("unit", unit).in("order_number", part).order("id").range(from, to)
      );
      for (const o of found) {
        const key = orderKey({ unit: o.unit, orderNumber: o.order_number });
        existing.set(key, {
          key,
          productCode: o.product_code,
          launchDate: o.launch_date,
          quantity: Number(o.quantity),
          unitCost: o.unit_cost == null ? null : Number(o.unit_cost),
          status: o.status,
        });
      }
    }
  }

  return { catalog, history, existing };
}
