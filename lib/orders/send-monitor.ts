import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyCycleReports, type CycleReportLike } from "@/lib/orders/classify-send";
import { sendDeadlineDateForDelivery, sendDeadlineForDelivery, SEND_DEADLINE_TIME } from "@/lib/delivery-schedule";
import { fortalezaDateISO, weekdayOfISODate, zonedInstant, addDaysISO } from "@/lib/dates";
import type { DeliveryRoute, Store, StoreDeliveryDay, Weekday } from "@/lib/types/database.types";

type ReportRow = CycleReportLike & { store_id: string; delivery_date: string | null };

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

  const { data: configs } = cohorts.length
    ? await supabase.from("store_delivery_days").select("*").in("weekday", cohorts.map((c) => c.weekday))
    : { data: [] as StoreDeliveryDay[] };
  const configsList = (configs ?? []) as StoreDeliveryDay[];

  const configCohorts = configsList.flatMap((config) =>
    cohorts.filter((c) => c.weekday === config.weekday).map((cohort) => ({ config, cohort }))
  );

  const cohortStoreIds = [...new Set(configsList.map((c) => c.store_id))];
  const deliveryDates = cohorts.map((c) => c.deliveryDate);

  // late orders still waiting for an admin's approval matter whatever their deadline was
  // (as long as the delivery hasn't happened): they need a decision, so they always show here
  const [{ data: cohortReports }, { data: awaiting }] = await Promise.all([
    cohortStoreIds.length
      ? supabase
          .from("store_stock_reports")
          .select("id, store_id, delivery_date, created_at, late_for_order_id, late_acknowledged")
          .in("store_id", cohortStoreIds)
          .in("delivery_date", deliveryDates)
      : Promise.resolve({ data: [] as ReportRow[] }),
    supabase
      .from("store_stock_reports")
      .select("id, store_id, delivery_date, created_at, late_for_order_id, late_acknowledged")
      .not("late_for_order_id", "is", null)
      .eq("late_acknowledged", false)
      .gt("delivery_date", todayISO),
  ]);

  const reportRows = [...((cohortReports ?? []) as ReportRow[]), ...((awaiting ?? []) as ReportRow[])];
  const reportsByKey = new Map<string, ReportRow[]>();
  const seenReportIds = new Set<string>();
  for (const r of reportRows) {
    if (!r.delivery_date || seenReportIds.has(r.id)) continue;
    seenReportIds.add(r.id);
    const key = `${r.store_id}:${r.delivery_date}`;
    reportsByKey.set(key, [...(reportsByKey.get(key) ?? []), r]);
  }

  // what a decided late report's outcome was (approved vs refused)
  const decidedIds = reportRows.filter((r) => r.late_for_order_id !== null && r.late_acknowledged).map((r) => r.id);
  const lastDecisionByReport = new Map<string, string>();
  if (decidedIds.length) {
    const { data: decisions } = await createAdminClient()
      .from("late_report_decisions")
      .select("report_id, decision, decided_at")
      .in("report_id", decidedIds)
      .order("decided_at", { ascending: true });
    for (const d of (decisions ?? []) as { report_id: string; decision: string }[]) {
      lastDecisionByReport.set(d.report_id, d.decision);
    }
  }

  const awaitingStoreIds = [...new Set(((awaiting ?? []) as ReportRow[]).map((r) => r.store_id))];
  const allStoreIds = [...new Set([...cohortStoreIds, ...awaitingStoreIds])];
  if (allStoreIds.length === 0) return [];

  const { data: stores } = await supabase.from("stores").select("*").in("id", allStoreIds);
  const storesList = (stores ?? []) as Store[];
  const storesById = Object.fromEntries(storesList.map((s) => [s.id, s]));
  const routeIds = [...new Set(storesList.map((s) => s.route_id))];
  const { data: routes } = routeIds.length
    ? await supabase.from("delivery_routes").select("*").in("id", routeIds)
    : { data: [] as DeliveryRoute[] };
  const routesById = Object.fromEntries(((routes ?? []) as DeliveryRoute[]).map((r) => [r.id, r]));

  const makeEntry = (
    storeId: string,
    deliveryDate: string,
    status: SendMonitorStatus,
    submittedAtMs: number | null,
    carriedOver: boolean
  ): SendMonitorEntry => {
    const store = storesById[storeId];
    return {
      storeId,
      storeName: store?.name ?? "?",
      routeName: store ? routesById[store.route_id]?.name ?? "?" : "?",
      deliveryDate,
      deliveryWeekday: weekdayOfISODate(deliveryDate),
      deadlineTime: SEND_DEADLINE_TIME,
      status,
      submittedAt: submittedAtMs === null ? null : new Date(submittedAtMs).toISOString(),
      carriedOver,
    };
  };

  const entries: SendMonitorEntry[] = [];
  const shown = new Set<string>();

  for (const { config, cohort } of configCohorts) {
    const key = `${config.store_id}:${cohort.deliveryDate}`;
    const deadline = sendDeadlineForDelivery(cohort.deliveryDate);
    const classified = classifyCycleReports(reportsByKey.get(key) ?? [], deadline.getTime(), lastDecisionByReport);
    const carriedOver = cohort.sendDate === yesterdayISO;

    if (carriedOver) {
      // resolved yesterday (sent in time or approved) — nothing to carry over
      if (classified?.state === "on_time") continue;
      // one full day past the deadline (end of today) — drop it unless it still awaits approval
      if (classified?.state !== "late" && now.getTime() > zonedInstant(todayISO, SEND_DEADLINE_TIME).getTime()) continue;
    }

    let status: SendMonitorStatus;
    if (classified?.state === "on_time") status = "on_time";
    else if (classified?.state === "late") status = "late";
    else status = now.getTime() <= deadline.getTime() ? "pending" : "overdue";

    shown.add(key);
    entries.push(
      makeEntry(config.store_id, cohort.deliveryDate, status, classified && classified.state !== "refused" ? classified.sentAt : null, carriedOver)
    );
  }

  // waiting-for-approval orders of other deliveries (not in today's board by deadline)
  for (const [key, rows] of reportsByKey) {
    if (shown.has(key)) continue;
    const [storeId, deliveryDate] = key.split(":");
    const classified = classifyCycleReports(rows, sendDeadlineForDelivery(deliveryDate).getTime(), lastDecisionByReport);
    if (classified?.state !== "late") continue;
    entries.push(makeEntry(storeId, deliveryDate, "late", classified.sentAt, false));
  }

  // most urgent first: overdue (not sent past the deadline), then late orders awaiting approval,
  // then stores still within their deadline, then the ones already sent in time
  const priority: Record<SendMonitorStatus, number> = { overdue: 0, late: 1, pending: 2, on_time: 3 };
  return entries.sort(
    (x, y) =>
      priority[x.status] - priority[y.status] ||
      x.deliveryDate.localeCompare(y.deliveryDate) ||
      x.storeName.localeCompare(y.storeName)
  );
}
