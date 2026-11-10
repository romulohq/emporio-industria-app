"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

/** Link geral: a pessoa escolhe a loja e segue para o formulário próprio dela (o endereço com a chave da loja não vai para a página). */
export async function openStoreForm(formData: FormData) {
  const id = String(formData.get("store") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/relatar-estoque?erro=1");

  const admin = createAdminClient();
  const { data: store } = await admin.from("stores").select("access_token").eq("id", id).eq("active", true).maybeSingle();
  if (!store) redirect("/relatar-estoque?erro=1");

  redirect(`/relatar-estoque/${store.access_token}`);
}
