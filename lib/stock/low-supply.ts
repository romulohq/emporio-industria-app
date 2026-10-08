export type CountLike = { product_id: string; count_date: string; stock_units: number };

export type LowSupplyProduct = {
  id: string;
  name: string;
  unit: string;
  min: number;
  stock: number;
  ratio: number;
  countDate: string;
};

/** The most recent count of each product. */
export function latestCountByProduct(counts: CountLike[]): Map<string, CountLike> {
  const latest = new Map<string, CountLike>();
  for (const c of counts) {
    const current = latest.get(c.product_id);
    if (!current || c.count_date > current.count_date) latest.set(c.product_id, c);
  }
  return latest;
}

/**
 * Products whose latest count covers less than `threshold` of their minimum (default 20%), most
 * critical first. A product with no count, or no minimum, is not judged — never counted does not
 * mean out of stock.
 */
export function productsRunningLow(
  products: { id: string; name: string; unit: string; min_quantity: number }[],
  latest: Map<string, CountLike>,
  threshold = 0.2
): LowSupplyProduct[] {
  const result: LowSupplyProduct[] = [];
  for (const p of products) {
    const count = latest.get(p.id);
    const min = Number(p.min_quantity);
    if (!count || !(min > 0)) continue;
    const stock = Number(count.stock_units);
    const ratio = stock / min;
    if (ratio < threshold) {
      result.push({ id: p.id, name: p.name, unit: p.unit, min, stock, ratio, countDate: count.count_date });
    }
  }
  return result.sort((a, b) => a.ratio - b.ratio || a.name.localeCompare(b.name));
}
