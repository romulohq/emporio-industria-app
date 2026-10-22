const PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

/**
 * Reads every row of a query. The database API returns at most 1000 rows per request and cuts the
 * rest without any error, so a query that can pass that (store reports are ~70 rows per send) must
 * be read page by page. `page(from, to)` builds the query for one page and must include a stable
 * order (e.g. created_at plus id) so no row is skipped or repeated between pages.
 */
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<PageResult<T>>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}
