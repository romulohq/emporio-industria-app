"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-session";
import { createMovementSchema } from "@/lib/validations/movement";

export type FormState = { error?: string } | undefined;

export async function createMovement(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await requireUser();

  const parsed = createMovementSchema.safeParse({
    product_id: formData.get("product_id"),
    movement_type: formData.get("movement_type"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { product_id, movement_type, reason } = parsed.data;
  let { quantity } = parsed.data;

  // Enforce the sign convention expected by the DB check constraint:
  // entry > 0, exit < 0, adjustment can be either.
  if (movement_type === "entry") quantity = Math.abs(quantity);
  if (movement_type === "exit") quantity = -Math.abs(quantity);

  const supabase = await createClient();
  const { error } = await supabase.from("stock_movements").insert({
    product_id,
    movement_type,
    quantity,
    reason,
    created_by: userId,
  });

  if (error) {
    return {
      error:
        "Não foi possível registrar a movimentação. Verifique se há saldo suficiente e se você tem acesso a este setor.",
    };
  }

  revalidatePath("/estoque/saldo");
  revalidatePath("/historico");
  redirect("/estoque/saldo");
}
