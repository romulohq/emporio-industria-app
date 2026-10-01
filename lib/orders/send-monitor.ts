import "server-only";
import { createClient } from "@/lib/supabase/server";
import { nextOccurrenceOnOrAfter } from "@/lib/delivery-schedule";
import { fortalezaDateISO, weekdayOfISODate, zonedInstant, addDaysISO } from "@/lib/dates";
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
  /** deadline was yesterday, not today — carried over into today's board because it's still unresolved */
  carriedOver: boolean;
};

type Cohort = { sendDateISO: string; weekday: Weekday };

/**
 * Every store whose send deadline (store_delivery_days.send_weekday) is
 * today — i.e. who needs to submit their stock report today for some
 * upcoming delivery cycle — with whether they already did, and whether that
 * was within their own deadline for today.
 *
 * A store whose deadline was YESTERDAY and still isn't resolved (never
 * submitted, or submitted late) carries over into today's board too, but
 * only through the end of today — one full day past the deadline, matching
 * the production day that follows it. After that it drops off regardless.
 */
export async function getTodaySendMonitor(): Promise<SendMonitorEntry[]> {
  const supabase = await createClient();
  const now = new Date();
  const todayISO = fortalezaDateISO();
  const yesterdayISO = addDaysISO(todayISO, -1);
  const cohorts: Cohort[] = [
    { sendDateISO: todayISO, weekday: weekdayOfISODate(todayISO) },
    { sendDateISO: yesterdayISO, weekday: weekdayOfISODate(yesterdayISO) },
  ];

  const { data: configs } = await supabase
    .from("store_delivery_days")
    .select("*")
    .in("send_weekday", cohorts.map((c) => c.weekday));
  const configsList = (configs ?? []) as StoreDeliveryDay[];
  if (configsList.length === 0) return [];

  // pair each config with the cohort (today's own, or yesterday's carry-over) it belongs to
  const configCohorts = configsList.map((config) => ({
    config,
    cohort: cohorts.find((c) => c.weekday === config.send_weekday)!,
  }));

  const storeIds = [...new Set(configsList.map((c) => c.store_id))];
  const deliveryDates = [
    ...new Set(configCohorts.map(({ config, cohort }) => nextOccurrenceOnOrAfter(cohort.sendDateISO, config.weekday))),
  ];

  const [{ data: stores }, { data: reports }] = await Promise.all([
    supabase.from("stores").select("*").in("id", storeIds),
    supabase
      .from("store_stock_reports")
      .select("store_id, delivery_date, created_at")
      .in("store_id", storeIds)
      .in("delivery_date", deliveryDates)
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

  const entries: SendMonitorEntry[] = [];
  for (const { config, cohort } of configCohorts) {
    const store = storesById[config.store_id];
    const deliveryDate = nextOccurrenceOnOrAfter(cohort.sendDateISO, config.weekday);
    const deadline = zonedInstant(cohort.sendDateISO, config.deadline_time);
    const submittedAt = earliestReportByStoreDate.get(`${config.store_id}:${deliveryDate}`) ?? null;
    const carriedOver = cohort.sendDateISO === yesterdayISO;

    if (carriedOver) {
      // resolved on time yesterday — nothing to carry over
      if (submittedAt && new Date(submittedAt).getTime() <= deadline.getTime()) continue;
      // one full day past the deadline (today, same clock time) — drop it regardless of outcome
      const graceUntil = zonedInstant(todayISO, config.deadline_time);
      if (now.getTime() > graceUntil.getTime()) continue;
    }

    let status: SendMonitorStatus;
    if (submittedAt) {
      status = new Date(submittedAt).getTime() <= deadline.getTime() ? "on_time" : "late";
    } else {
      status = now.getTime() <= deadline.getTime() ? "pending" : "overdue";
    }

    entries.push({
      storeId: config.store_id,
      storeName: store?.name ?? "?",
      routeName: store ? routesById[store.route_id]?.name ?? "?" : "?",
      deliveryDate,
      deliveryWeekday: config.weekday,
      deadlineTime: config.deadline_time.slice(0, 5),
      status,
      submittedAt,
      carriedOver,
    });
  }

  return entries.sort((a, b) => a.storeName.localeCompare(b.storeName));
}
