"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { createRouteSchema } from "@/lib/validations/route";
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
