import "server-only";
import { computeDayOrderPlan } from "@/lib/orders/compute-day-order-plan";
import { applyDayOrderPlan } from "@/lib/orders/apply-day-order-plan";

/**
 * Generates (or refreshes) the production orders for every store scheduled
 * to deliver on `deliveryDateISO`, using each store's latest stock report
 * submitted for THIS exact delivery cycle (store_stock_reports.delivery_date
 * = deliveryDateISO). A store that hasn't reported for this cycle falls back
 * to its most recent earlier submission (see compute-day-order-plan.ts) and
 * stays on the "Pedido não recebido" list in the Pedidos page.
 * A store's contribution that an admin has manually locked (see
 * lib/orders/manual-contribution.ts) is left untouched — it stops following
 * the automatic "latest report wins" rule until the admin reverts it.
 */
export async function generateDayOrders(deliveryDateISO: string) {
  const plan = await computeDayOrderPlan(deliveryDateISO);
  return applyDayOrderPlan(deliveryDateISO, plan);
}
