import { NextResponse } from "next/server";
import { generateDayOrders } from "@/lib/orders/generate-day-orders";
import { deliveryDatesProducedOn } from "@/lib/delivery-schedule";
import { fortalezaDateISO } from "@/lib/dates";

/**
 * Runs once a day (see vercel.json) and generates the production orders for
 * every delivery whose production day is today — tomorrow's delivery, except
 * Saturday also produces Sunday's and Monday's (no Sunday production).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const results = [];
  for (const deliveryDate of deliveryDatesProducedOn(fortalezaDateISO())) {
    results.push({ deliveryDate, ...(await generateDayOrders(deliveryDate)) });
  }
  return NextResponse.json({ ok: true, results });
}
