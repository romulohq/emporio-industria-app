"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { createRouteSchema } from "@/lib/validations/route";
import { scheduleSchema } from "@/lib/validations/delivery-schedule";
import { slugify } from "@/lib/format/slugify";

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

  // full replace: this unit's stores' schedule is fully described by the submitted list
  await supabase.from("store_delivery_days").delete().in("store_id", storeIds);
  if (parsed.data.length > 0) {
    await supabase.from("store_delivery_days").insert(parsed.data);
  }

  revalidatePath("/admin/rotas");
}
