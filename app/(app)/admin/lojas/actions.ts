"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { createStoreSchema, updateStoreSchema } from "@/lib/validations/store";
import { storeProductMinRowSchema } from "@/lib/validations/store-product-min";
import { storeWeekdaysSchema } from "@/lib/validations/delivery-schedule";
import { relinkStoreReports } from "@/lib/orders/relink-store-reports";

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

  let weekdaysRaw: unknown;
  try {
    weekdaysRaw = JSON.parse(String(formData.get("weekdays") ?? "[]"));
  } catch {
    return;
  }

  const parsed = storeWeekdaysSchema.safeParse({
    store_id: formData.get("store_id"),
    weekdays: weekdaysRaw,
  });
  if (!parsed.success) return;

  const { store_id, weekdays } = parsed.data;
  const supabase = await createClient();

  const { data: previousDays } = await supabase.from("store_delivery_days").select("weekday").eq("store_id", store_id);
  const previousWeekdays = new Set((previousDays ?? []).map((d) => d.weekday as string));

  await supabase
    .from("store_delivery_days")
    .delete()
    .eq("store_id", store_id)
    .not("weekday", "in", `(${weekdays.length ? weekdays.join(",") : "''"})`);

  if (weekdays.length) {
    await supabase
      .from("store_delivery_days")
      .upsert(
        weekdays.map((weekday) => ({ store_id, weekday })),
        { onConflict: "store_id,weekday", ignoreDuplicates: true }
      );
  }

  await relinkStoreReports(
    weekdays.filter((weekday) => !previousWeekdays.has(weekday)).map((weekday) => ({ storeId: store_id, weekday }))
  );

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
