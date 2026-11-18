"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { OSORIO_ORDERS, RUI_ORDERS } from "@/lib/orders/units";

const PICKER_PATHS = [RUI_ORDERS.storePickerPath, OSORIO_ORDERS.storePickerPath];

/** Link geral: a pessoa escolhe a loja e segue para o formulário próprio dela (o endereço com a chave da loja não vai para a página). */
export async function openStoreForm(formData: FormData) {
  const requested = String(formData.get("back") ?? "");
  const back = PICKER_PATHS.includes(requested) ? requested : RUI_ORDERS.storePickerPath;

  const id = String(formData.get("store") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect(`${back}?erro=1`);

  const admin = createAdminClient();
  const { data: store } = await admin.from("stores").select("access_token").eq("id", id).eq("active", true).maybeSingle();
  if (!store) redirect(`${back}?erro=1`);

  redirect(`/relatar-estoque/${store.access_token}`);
}
