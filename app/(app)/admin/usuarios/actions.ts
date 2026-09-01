"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/get-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserSchema, updateUserSectorsSchema } from "@/lib/validations/user";

export type FormState = { error?: string } | undefined;

export async function createUser(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    full_name: formData.get("full_name"),
    password: formData.get("password"),
    is_admin: formData.get("is_admin") === "on",
    sector_ids: formData.getAll("sector_ids"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { email, full_name, password, is_admin, sector_ids } = parsed.data;
  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (createError || !created.user) {
    return { error: "Não foi possível criar o usuário. E-mail já cadastrado?" };
  }

  const userId = created.user.id;

  // handle_new_user trigger already inserted the profiles row; now set admin flag + sectors.
  await admin.from("profiles").update({ is_admin, full_name }).eq("id", userId);

  if (sector_ids.length > 0) {
    await admin
      .from("user_sectors")
      .insert(sector_ids.map((sector_id) => ({ user_id: userId, sector_id })));
  }

  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios");
}

export async function updateUserSectors(formData: FormData) {
  await requireAdmin();

  const parsed = updateUserSectorsSchema.safeParse({
    user_id: formData.get("user_id"),
    is_admin: formData.get("is_admin") === "on",
    sector_ids: formData.getAll("sector_ids"),
  });

  if (!parsed.success) return;

  const { user_id, is_admin, sector_ids } = parsed.data;
  const admin = createAdminClient();

  await admin.from("profiles").update({ is_admin }).eq("id", user_id);
  await admin.from("user_sectors").delete().eq("user_id", user_id);

  if (sector_ids.length > 0) {
    await admin
      .from("user_sectors")
      .insert(sector_ids.map((sector_id) => ({ user_id, sector_id })));
  }

  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${user_id}`);
}
