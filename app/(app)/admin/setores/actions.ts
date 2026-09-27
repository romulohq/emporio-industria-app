"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { updateSectorResponsibleSchema } from "@/lib/validations/sector";

export async function updateSectorResponsible(formData: FormData) {
  await requireAdmin();

  const parsed = updateSectorResponsibleSchema.safeParse({
    id: formData.get("id"),
    responsible_name: formData.get("responsible_name"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("sectors")
    .update({ responsible_name: parsed.data.responsible_name })
    .eq("id", parsed.data.id);

  revalidatePath("/admin/setores");
  revalidatePath("/pedidos/dia");
}
