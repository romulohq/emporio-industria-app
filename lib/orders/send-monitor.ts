import "server-only";
import { createClient } from "@/lib/supabase/server";
import { sendDeadlineDateForDelivery, sendDeadlineForDelivery, SEND_DEADLINE_TIME } from "@/lib/delivery-schedule";
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

/**
 * Every store whose send deadline (see lib/delivery-schedule.ts) is today —
 * i.e. who needs to submit their stock report today for some upcoming
 * delivery — with whether they already did, and whether that was in time.
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

  // a deadline is always 2–3 days before its delivery, so these are the only
  // deliveries that can have a deadline today or yesterday
  const cohorts = [1, 2, 3]
    .map((offset) => addDaysISO(todayISO, offset))
    .map((deliveryDate) => ({
      deliveryDate,
      weekday: weekdayOfISODate(deliveryDate),
      sendDate: sendDeadlineDateForDelivery(deliveryDate),
    }))
    .filter((c) => c.sendDate === todayISO || c.sendDate === yesterdayISO);
  if (cohorts.length === 0) return [];

  const { data: configs } = await supabase
    .from("store_delivery_days")
    .select("*")
    .in("weekday", cohorts.map((c) => c.weekday));
  const configsList = (configs ?? []) as StoreDeliveryDay[];
  if (configsList.length === 0) return [];

  const configCohorts = configsList.flatMap((config) =>
    cohorts.filter((c) => c.weekday === config.weekday).map((cohort) => ({ config, cohort }))
  );

  const storeIds = [...new Set(configsList.map((c) => c.store_id))];
  const deliveryDates = cohorts.map((c) => c.deliveryDate);

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
    const deadline = sendDeadlineForDelivery(cohort.deliveryDate);
    const submittedAt = earliestReportByStoreDate.get(`${config.store_id}:${cohort.deliveryDate}`) ?? null;
    const carriedOver = cohort.sendDate === yesterdayISO;

    if (carriedOver) {
      // resolved on time yesterday — nothing to carry over
      if (submittedAt && new Date(submittedAt).getTime() <= deadline.getTime()) continue;
      // one full day past the deadline (end of today) — drop it regardless of outcome
      if (now.getTime() > zonedInstant(todayISO, SEND_DEADLINE_TIME).getTime()) continue;
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
      deliveryDate: cohort.deliveryDate,
      deliveryWeekday: config.weekday,
      deadlineTime: SEND_DEADLINE_TIME,
      status,
      submittedAt,
      carriedOver,
    });
  }

  return entries.sort((a, b) => a.storeName.localeCompare(b.storeName));
}
