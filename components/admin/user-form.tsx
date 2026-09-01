"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/app/(app)/admin/usuarios/actions";
import type { Sector } from "@/lib/types/database.types";

const initialState: FormState = undefined;

export function UserForm({
  sectors,
  action,
  defaultIsAdmin,
  defaultSectorIds,
}: {
  sectors: Sector[];
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaultIsAdmin?: boolean;
  defaultSectorIds?: string[];
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const selected = new Set(defaultSectorIds ?? []);

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <div>
        <Label htmlFor="full_name">Nome completo</Label>
        <Input id="full_name" name="full_name" required />
      </div>

      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" required />
      </div>

      <div>
        <Label htmlFor="password">Senha inicial</Label>
        <Input id="password" name="password" type="password" minLength={6} required />
      </div>

      <div>
        <Label>Setores</Label>
        <div className="space-y-1 rounded-md border border-neutral-200 p-3">
          {sectors.map((sector) => (
            <label key={sector.id} className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                name="sector_ids"
                value={sector.id}
                defaultChecked={selected.has(sector.id)}
              />
              {sector.name}
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" name="is_admin" defaultChecked={defaultIsAdmin} />
        Administrador (acesso a todos os setores e à gestão de usuários)
      </label>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
