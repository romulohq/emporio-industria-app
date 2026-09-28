import "server-only";
import { computeDayOrderPlan } from "@/lib/orders/compute-day-order-plan";
import { applyDayOrderPlan } from "@/lib/orders/apply-day-order-plan";

/**
 * Generates (or refreshes) the production orders for every store scheduled
 * to deliver on `deliveryDateISO`, using each store's latest stock report
 * submitted for THIS exact delivery cycle (store_stock_reports.delivery_date
 * = deliveryDateISO) — a report from a past or future cycle is never reused,
 * so a store that hasn't reported yet for this cycle simply contributes
 * nothing (see the "Pedido não recebido" list computed in the Pedidos page).
 * A store's contribution that an admin has manually locked (see
 * lib/orders/manual-contribution.ts) is left untouched — it stops following
 * the automatic "latest report wins" rule until the admin reverts it.
 */
export async function generateDayOrders(deliveryDateISO: string) {
  const plan = await computeDayOrderPlan(deliveryDateISO);
  return applyDayOrderPlan(deliveryDateISO, plan);
}
