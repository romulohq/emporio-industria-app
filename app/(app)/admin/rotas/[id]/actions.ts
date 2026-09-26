"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { WEEKDAY_ORDER } from "@/lib/format/labels";
import type { Weekday } from "@/lib/types/database.types";

const WEEKDAY_SET = new Set<string>(WEEKDAY_ORDER);

export async function saveDeliveryDays(formData: FormData) {
  await requireAdmin();

  const routeId = String(formData.get("route_id"));
  const storeIds = formData.getAll("store_id").map(String);
  if (storeIds.length === 0) return;

  const rows: { store_id: string; weekday: Weekday }[] = [];
  for (const [key, value] of formData.entries()) {
    if (value !== "on" || !key.startsWith("day_")) continue;
    const rest = key.slice(4);
    const separatorIndex = rest.lastIndexOf("_");
    if (separatorIndex === -1) continue;
    const storeId = rest.slice(0, separatorIndex);
    const weekday = rest.slice(separatorIndex + 1);
    if (!storeIds.includes(storeId) || !WEEKDAY_SET.has(weekday)) continue;
    rows.push({ store_id: storeId, weekday: weekday as Weekday });
  }

  const supabase = await createClient();

  // full replace: clear this route's stores' schedule, then insert what's checked now
  await supabase.from("store_delivery_days").delete().in("store_id", storeIds);
  if (rows.length > 0) {
    await supabase.from("store_delivery_days").insert(rows);
  }

  revalidatePath(`/admin/rotas/${routeId}`);
}
