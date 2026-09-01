import { createClient } from "@/lib/supabase/server";
import { UserForm } from "@/components/admin/user-form";
import { createUser } from "@/app/(app)/admin/usuarios/actions";
import type { Sector } from "@/lib/types/database.types";

export default async function NovoUsuarioPage() {
  const supabase = await createClient();
  const { data: sectors } = await supabase.from("sectors").select("*").order("name");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-neutral-900">Novo usuário</h1>
      <UserForm sectors={(sectors ?? []) as Sector[]} action={createUser} />
    </div>
  );
}
