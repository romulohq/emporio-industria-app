import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};

function query(table: string) {
  let rows = [...(tables[table] ?? [])];
  let sort: { col: string; asc: boolean } | null = null;
  const builder = {
    select: () => builder,
    eq: (col: string, val: unknown) => ((rows = rows.filter((r) => r[col] === val)), builder),
    in: (col: string, vals: unknown[]) => ((rows = rows.filter((r) => vals.includes(r[col]))), builder),
    or: (expr: string) => {
      // only: delivery_date.is.null,delivery_date.lt.<date>
      const lt = expr.match(/delivery_date\.lt\.(\S+)$/)![1];
      rows = rows.filter((r) => r.delivery_date === null || (r.delivery_date as string) < lt);
      return builder;
    },
    order: (col: string, opts: { ascending: boolean }) => ((sort = { col, asc: opts.ascending }), builder),
    then: (resolve: (v: { data: Row[] }) => unknown) => {
      if (sort) {
        const { col, asc } = sort;
        rows.sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1));
      }
      return Promise.resolve({ data: rows }).then(resolve);
    },
  };
  return builder;
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: query }) }));

import { computeDayOrderPlan } from "@/lib/orders/compute-day-order-plan";

const MONDAY = "2026-10-05";
const P = "product-1";
const report = (id: string, store: string, qty: number, delivery: string | null, createdAt: string, submission: string) => ({
  id, store_id: store, product_id: P, quantity_reported: qty, delivery_date: delivery, created_at: createdAt, submission_id: submission,
});

beforeEach(() => {
  tables.store_delivery_days = [
    { store_id: "A", weekday: "monday" },
    { store_id: "B", weekday: "monday" },
    { store_id: "C", weekday: "monday" },
  ];
  tables.store_product_mins = ["A", "B", "C"].map((s) => ({ store_id: s, product_id: P, min_quantity: 10 }));
  tables.products = [{ id: P, name: "Pudim", sector_id: "s1", unit: "un" }];
  tables.store_stock_reports = [];
});

describe("computeDayOrderPlan fallback to the last order", () => {
  it("uses this cycle's report when the store sent one (latest wins)", async () => {
    tables.store_stock_reports = [
      report("r1", "A", 8, MONDAY, "2026-10-01T10:00:00Z", "s1"),
      report("r2", "A", 4, MONDAY, "2026-10-02T10:00:00Z", "s2"),
    ];
    const plan = await computeDayOrderPlan(MONDAY);
    expect(plan.byProduct.get(P)!.get("A")).toEqual({ quantity: 6, reportId: "r2" });
  });

  it("falls back to the store's most recent earlier submission when it didn't send this cycle", async () => {
    tables.store_stock_reports = [
      report("old1", "B", 9, "2026-09-29", "2026-09-28T10:00:00Z", "sub-old"),
      report("new1", "B", 2, "2026-10-03", "2026-10-02T10:00:00Z", "sub-new"),
      report("a1", "A", 5, MONDAY, "2026-10-02T11:00:00Z", "sub-a"),
    ];
    const contributions = (await computeDayOrderPlan(MONDAY)).byProduct.get(P)!;
    expect(contributions.get("A")).toEqual({ quantity: 5, reportId: "a1" });
    expect(contributions.get("B")).toEqual({ quantity: 8, reportId: "new1" }); // most recent, not the older 9
  });

  it("never uses a report meant for a later cycle", async () => {
    tables.store_stock_reports = [report("future", "B", 1, "2026-10-12", "2026-10-02T10:00:00Z", "sub-f")];
    const plan = await computeDayOrderPlan(MONDAY);
    expect(plan.byProduct.get(P)?.has("B") ?? false).toBe(false);
  });

  it("a store that never reported contributes nothing", async () => {
    tables.store_stock_reports = [report("a1", "A", 5, MONDAY, "2026-10-02T11:00:00Z", "sub-a")];
    const contributions = (await computeDayOrderPlan(MONDAY)).byProduct.get(P)!;
    expect(contributions.has("C")).toBe(false);
  });

  it("excluding a store's only cycle report makes it fall back to the older one", async () => {
    tables.store_stock_reports = [
      report("older", "A", 7, "2026-09-29", "2026-09-28T10:00:00Z", "sub-old"),
      report("late", "A", 1, MONDAY, "2026-10-03T10:00:00Z", "sub-late"),
    ];
    const plan = await computeDayOrderPlan(MONDAY, { excludeReportIds: new Set(["late"]) });
    expect(plan.byProduct.get(P)!.get("A")).toEqual({ quantity: 3, reportId: "older" });
  });
});
