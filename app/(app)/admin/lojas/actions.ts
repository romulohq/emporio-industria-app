"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { createStoreSchema, updateStoreSchema } from "@/lib/validations/store";
import { storeProductMinRowSchema } from "@/lib/validations/store-product-min";
import { deadlineScheduleSchema } from "@/lib/validations/delivery-schedule";

export type FormState = { error?: string } | undefined;

export async function createStore(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = createStoreSchema.safeParse({
    route_id: formData.get("route_id"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("stores").insert(parsed.data);

  if (error) {
    return { error: "Não foi possível criar a loja." };
  }

  revalidatePath("/admin/lojas");
  redirect("/admin/lojas");
}

export async function updateStore(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = updateStoreSchema.safeParse({
    id: formData.get("id"),
    route_id: formData.get("route_id"),
    name: formData.get("name"),
    active: formData.get("active") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("stores")
    .update({
      route_id: parsed.data.route_id,
      name: parsed.data.name,
      active: parsed.data.active,
    })
    .eq("id", parsed.data.id);

  if (error) {
    return { error: "Não foi possível salvar as alterações." };
  }

  revalidatePath("/admin/lojas");
  redirect("/admin/lojas");
}

export async function regenerateStoreToken(formData: FormData) {
  await requireAdmin();
  const storeId = String(formData.get("store_id"));
  const supabase = await createClient();
  const newToken = randomBytes(16).toString("hex");
  await supabase.from("stores").update({ access_token: newToken }).eq("id", storeId);
  revalidatePath("/admin/lojas");
}

export async function saveStoreDeliverySchedule(formData: FormData) {
  await requireAdmin();

  let entriesRaw: unknown;
  try {
    entriesRaw = JSON.parse(String(formData.get("entries") ?? "[]"));
  } catch {
    return;
  }

  const parsed = deadlineScheduleSchema.safeParse({
    store_id: formData.get("store_id"),
    entries: entriesRaw,
  });
  if (!parsed.success) return;

  const { store_id, entries } = parsed.data;
  const supabase = await createClient();
  const enabledWeekdays = entries.map((e) => e.weekday);

  await supabase
    .from("store_delivery_days")
    .delete()
    .eq("store_id", store_id)
    .not("weekday", "in", `(${enabledWeekdays.length ? enabledWeekdays.join(",") : "''"})`);

  if (entries.length) {
    await supabase.from("store_delivery_days").upsert(
      entries.map((e) => ({
        store_id,
        weekday: e.weekday,
        send_weekday: e.send_weekday,
        deadline_time: e.deadline_time,
        is_custom: e.is_custom,
      })),
      { onConflict: "store_id,weekday" }
    );
  }

  revalidatePath(`/admin/lojas/${store_id}`);
  revalidatePath(`/admin/lojas/${store_id}/prazos`);
  revalidatePath("/admin/rotas");
}

export async function saveStoreProductMins(formData: FormData) {
  await requireAdmin();
  const storeId = String(formData.get("store_id"));

  const rows: { product_id: string; min_quantity: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("min_")) continue;
    const parsed = storeProductMinRowSchema.safeParse({
      product_id: key.slice(4),
      min_quantity: value,
    });
    if (parsed.success) rows.push(parsed.data);
  }

  if (rows.length === 0) return;

  const supabase = await createClient();
  await supabase
    .from("store_product_mins")
    .upsert(
      rows.map((r) => ({ store_id: storeId, product_id: r.product_id, min_quantity: r.min_quantity })),
      { onConflict: "store_id,product_id" }
    );

  revalidatePath(`/admin/lojas/${storeId}/estoque-minimo`);
}
