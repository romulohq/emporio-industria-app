import { NextResponse } from "next/server";
import { generateDayOrders } from "@/lib/orders/generate-day-orders";
import { fortalezaDateISO } from "@/lib/dates";

/** Runs once a day (see vercel.json) to generate tomorrow's Rui Barbosa production orders. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await generateDayOrders(fortalezaDateISO(1));
  return NextResponse.json({ ok: true, ...result });
}
