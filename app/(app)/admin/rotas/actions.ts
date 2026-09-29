"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/get-session";
import { createRouteSchema } from "@/lib/validations/route";
import { scheduleSchema, applyRouteImpactSchema } from "@/lib/validations/delivery-schedule";
import { defaultSendWeekday, DEFAULT_DEADLINE_TIME } from "@/lib/delivery-schedule";
import { computeRouteScheduleImpact } from "@/lib/orders/route-schedule-impact";
import { regenerateSectorDayOrder } from "@/lib/orders/regenerate-day-order";
import { slugify } from "@/lib/format/slugify";
import type { StoreDeliveryDay, Weekday } from "@/lib/types/database.types";

export type FormState = { error?: string } | undefined;

export async function createRoute(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = createRouteSchema.safeParse({
    name: formData.get("name"),
    unit_id: formData.get("unit_id"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("delivery_routes").insert({
    name: parsed.data.name,
    slug: slugify(parsed.data.name),
    unit_id: parsed.data.unit_id,
  });

  if (error) {
    return { error: "Não foi possível criar a rota (nome já existe?)." };
  }

  revalidatePath("/admin/rotas");
  return undefined;
}

export async function saveUnitSchedule(formData: FormData) {
  await requireAdmin();

  const unitId = String(formData.get("unit_id"));
  let rawEntries: unknown;
  try {
    rawEntries = JSON.parse(String(formData.get("schedule") ?? "[]"));
  } catch {
    return;
  }

  const parsed = scheduleSchema.safeParse(rawEntries);
  if (!parsed.success || !unitId) return;

  const supabase = await createClient();

  const { data: routes } = await supabase
    .from("delivery_routes")
    .select("id")
    .eq("unit_id", unitId);
  const routeIds = (routes ?? []).map((r) => r.id);
  if (routeIds.length === 0) return;

  const { data: stores } = await supabase.from("stores").select("id").in("route_id", routeIds);
  const storeIds = (stores ?? []).map((s) => s.id);
  if (storeIds.length === 0) return;

  // this grid doesn't edit the deadline — preserve any per-store custom one
  // already set via Lojas → "Dias de entrega e prazos" instead of resetting it
  const { data: existingRows } = await supabase
    .from("store_delivery_days")
    .select("*")
    .in("store_id", storeIds);
  const existingByKey = new Map(
    ((existingRows ?? []) as StoreDeliveryDay[]).map((d) => [`${d.store_id}:${d.weekday}`, d])
  );

  const entriesWithDeadline = parsed.data.map((entry) => {
    const existing = existingByKey.get(`${entry.store_id}:${entry.weekday}`);
    return {
      ...entry,
      send_weekday: existing?.is_custom ? existing.send_weekday : defaultSendWeekday(entry.weekday),
      deadline_time: existing?.is_custom ? existing.deadline_time : DEFAULT_DEADLINE_TIME,
      is_custom: existing?.is_custom ?? false,
    };
  });

  // full replace, but upsert-first: if the insert fails, nothing already saved is lost
  if (entriesWithDeadline.length > 0) {
    const { error } = await supabase
      .from("store_delivery_days")
      .upsert(entriesWithDeadline, { onConflict: "store_id,weekday" });
    if (error) return;
  }

  const submittedKeys = new Set(parsed.data.map((e) => `${e.store_id}:${e.weekday}`));
  const toDelete = [...existingByKey.keys()].filter((key) => !submittedKeys.has(key));
  for (const key of toDelete) {
    const [deleteStoreId, deleteWeekday] = key.split(":");
    await supabase
      .from("store_delivery_days")
      .delete()
      .eq("store_id", deleteStoreId)
      .eq("weekday", deleteWeekday as Weekday);
  }

  revalidatePath("/admin/rotas");

  // a store just added to or removed from a weekday may affect an
  // already-generated order for that weekday's next delivery — surface a
  // review step instead of changing a printed order silently
  const addedKeys = [...submittedKeys].filter((key) => !existingByKey.has(key));
  const changedWeekdays = new Set<Weekday>();
  for (const key of [...addedKeys, ...toDelete]) changedWeekdays.add(key.split(":")[1] as Weekday);

  const impactGroups = await computeRouteScheduleImpact(changedWeekdays);
  if (impactGroups.length > 0) {
    const params = new URLSearchParams({ unit_id: unitId });
    for (const group of impactGroups) {
      params.append("sector_ids", group.sectorId);
      params.append("delivery_dates", group.deliveryDate);
    }
    redirect(`/admin/rotas/revisar-impacto?${params.toString()}`);
  }
}

/** Applies (regenerates) the day orders flagged as impacted by a route/schedule change. */
export async function applyRouteScheduleImpact(formData: FormData) {
  const { userId } = await requireAdmin();

  const parsed = applyRouteImpactSchema.safeParse({
    unit_id: formData.get("unit_id"),
    sector_ids: formData.getAll("sector_ids"),
    delivery_dates: formData.getAll("delivery_dates"),
  });
  if (!parsed.success || parsed.data.sector_ids.length !== parsed.data.delivery_dates.length) return;

  const { unit_id, sector_ids, delivery_dates } = parsed.data;

  for (let i = 0; i < sector_ids.length; i++) {
    await regenerateSectorDayOrder(
      sector_ids[i],
      delivery_dates[i],
      new Set(),
      "Alteração na rota/dias de entrega",
      userId
    );
  }

  revalidatePath("/pedidos");
  revalidatePath("/pedidos/dia");

  const admin = createAdminClient();
  const { data: unit } = await admin.from("production_units").select("slug").eq("id", unit_id).maybeSingle();
  redirect(`/admin/rotas${unit?.slug ? `?unit=${unit.slug}` : ""}`);
}
