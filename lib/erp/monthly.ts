import { isConcluded } from "@/lib/erp/analyze";

export type StoredOrder = {
  product_code: string;
  erp_description: string;
  launch_date: string;
  quantity: number;
  unit_measure: string | null;
  status: string;
};

export type ProductMonth = {
  code: string;
  name: string;
  unitMeasure: string;
  orders: number;
  quantity: number;
  kg: number;
};

export type MonthTotals = {
  month: string;
  orders: number;
  /** ordens que ainda não estão CONCLUÍDO (entram na soma mesmo assim) */
  open: number;
  units: number;
  kg: number;
  /** ordens em unidade sem peso cadastrado: ficam fora do total em kg */
  withoutWeight: number;
  products: ProductMonth[];
};

type CatalogEntry = { displayName: string; unitWeightKg: number | null };

/** Soma as ordens já gravadas por mês de lançamento e, dentro do mês, por produto. */
export function accumulateByMonth(orders: StoredOrder[], catalog: Map<string, CatalogEntry>): MonthTotals[] {
  const months = new Map<string, MonthTotals & { byProduct: Map<string, ProductMonth> }>();

  for (const order of orders) {
    const month = order.launch_date.slice(0, 7);
    const total = months.get(month) ?? { month, orders: 0, open: 0, units: 0, kg: 0, withoutWeight: 0, products: [], byProduct: new Map() };
    const quantity = Number(order.quantity);
    const isKg = order.unit_measure === "KG";
    const weight = catalog.get(order.product_code)?.unitWeightKg ?? null;
    const kg = isKg ? quantity : weight != null ? quantity * weight : 0;

    total.orders += 1;
    if (!isConcluded(order.status)) total.open += 1;
    if (isKg) total.kg += quantity;
    else {
      total.units += quantity;
      if (weight != null) total.kg += quantity * weight;
      else total.withoutWeight += 1;
    }

    const product = total.byProduct.get(order.product_code) ?? {
      code: order.product_code,
      name: catalog.get(order.product_code)?.displayName ?? order.erp_description,
      unitMeasure: isKg ? "KG" : (order.unit_measure ?? "UNID"),
      orders: 0,
      quantity: 0,
      kg: 0,
    };
    product.orders += 1;
    product.quantity += quantity;
    product.kg += kg;
    total.byProduct.set(order.product_code, product);
    months.set(month, total);
  }

  const round = (n: number) => Math.round(n * 1000) / 1000;
  return [...months.values()]
    .map(({ byProduct, ...m }) => ({
      ...m,
      units: round(m.units),
      kg: round(m.kg),
      products: [...byProduct.values()]
        .map((p) => ({ ...p, quantity: round(p.quantity), kg: round(p.kg) }))
        .sort((a, b) => b.kg - a.kg || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
}
