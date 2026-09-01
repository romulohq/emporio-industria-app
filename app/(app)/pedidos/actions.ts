"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-session";
import { createOrderSchema, updateOrderStatusSchema } from "@/lib/validations/order";

export type FormState = { error?: string } | undefined;

export async function createOrder(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await requireUser();

  const parsed = createOrderSchema.safeParse({
    product_id: formData.get("product_id"),
    quantity: formData.get("quantity"),
    priority: formData.get("priority"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("production_orders").insert({
    ...parsed.data,
    requested_by: userId,
  });

  if (error) {
    return { error: "Não foi possível criar a ordem. Verifique se você tem acesso a este setor." };
  }

  revalidatePath("/pedidos");
  redirect("/pedidos");
}

export async function updateOrderStatus(formData: FormData) {
  await requireUser();

  const parsed = updateOrderStatusSchema.safeParse({
    order_id: formData.get("order_id"),
    status: formData.get("status"),
  });

  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("production_orders")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.order_id);

  revalidatePath("/pedidos");
  revalidatePath("/estoque");
  revalidatePath("/historico");
}
