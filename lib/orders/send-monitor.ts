import "server-only";
import { createClient } from "@/lib/supabase/server";
import { nextOccurrenceOnOrAfter } from "@/lib/delivery-schedule";
import { fortalezaDateISO, weekdayOfISODate, zonedInstant } from "@/lib/dates";
import type { DeliveryRoute, Store, StoreDeliveryDay, StoreStockReport, Weekday } from "@/lib/types/database.types";

export type SendMonitorStatus = "on_time" | "late" | "pending" | "overdue";

export type SendMonitorEntry = {
  storeId: string;
  storeName: string;
  routeName: string;
  deliveryDate: string;
  deliveryWeekday: Weekday;
  deadlineTime: string;
  status: SendMonitorStatus;
  submittedAt: string | null;
};

/**
 * Every store whose send deadline (store_delivery_days.send_weekday) is
 * today — i.e. who needs to submit their stock report today for some
 * upcoming delivery cycle — with whether they already did, and whether that
 * was within their own deadline for today.
 */
export async function getTodaySendMonitor(): Promise<SendMonitorEntry[]> {
  const supabase = await createClient();
  const now = new Date();
  const todayISO = fortalezaDateISO();
  const todayWeekday = weekdayOfISODate(todayISO);

  const { data: configs } = await supabase
    .from("store_delivery_days")
    .select("*")
    .eq("send_weekday", todayWeekday);
  const configsList = (configs ?? []) as StoreDeliveryDay[];
  if (configsList.length === 0) return [];

  const storeIds = [...new Set(configsList.map((c) => c.store_id))];
  const [{ data: stores }, { data: reports }] = await Promise.all([
    supabase.from("stores").select("*").in("id", storeIds),
    supabase
      .from("store_stock_reports")
      .select("store_id, delivery_date, created_at")
      .in("store_id", storeIds)
      .in(
        "delivery_date",
        [...new Set(configsList.map((c) => nextOccurrenceOnOrAfter(todayISO, c.weekday)))]
      )
      .order("created_at", { ascending: true }),
  ]);

  const storesList = (stores ?? []) as Store[];
  const storesById = Object.fromEntries(storesList.map((s) => [s.id, s]));
  const routeIds = [...new Set(storesList.map((s) => s.route_id))];
  const { data: routes } = routeIds.length
    ? await supabase.from("delivery_routes").select("*").in("id", routeIds)
    : { data: [] as DeliveryRoute[] };
  const routesById = Object.fromEntries(((routes ?? []) as DeliveryRoute[]).map((r) => [r.id, r]));

  const earliestReportByStoreDate = new Map<string, string>();
  for (const r of (reports ?? []) as Pick<StoreStockReport, "store_id" | "delivery_date" | "created_at">[]) {
    if (!r.delivery_date) continue;
    const key = `${r.store_id}:${r.delivery_date}`;
    if (!earliestReportByStoreDate.has(key)) earliestReportByStoreDate.set(key, r.created_at);
  }

  const entries: SendMonitorEntry[] = configsList.map((config) => {
    const store = storesById[config.store_id];
    const deliveryDate = nextOccurrenceOnOrAfter(todayISO, config.weekday);
    const deadline = zonedInstant(todayISO, config.deadline_time);
    const submittedAt = earliestReportByStoreDate.get(`${config.store_id}:${deliveryDate}`) ?? null;

    let status: SendMonitorStatus;
    if (submittedAt) {
      status = new Date(submittedAt).getTime() <= deadline.getTime() ? "on_time" : "late";
    } else {
      status = now.getTime() <= deadline.getTime() ? "pending" : "overdue";
    }

    return {
      storeId: config.store_id,
      storeName: store?.name ?? "?",
      routeName: store ? routesById[store.route_id]?.name ?? "?" : "?",
      deliveryDate,
      deliveryWeekday: config.weekday,
      deadlineTime: config.deadline_time.slice(0, 5),
      status,
      submittedAt,
    };
  });

  return entries.sort((a, b) => a.routeName.localeCompare(b.routeName) || a.storeName.localeCompare(b.storeName));
}
