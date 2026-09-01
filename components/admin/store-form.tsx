"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { FormState } from "@/app/(app)/admin/lojas/actions";
import type { DeliveryRoute, Store } from "@/lib/types/database.types";

const initialState: FormState = undefined;

export function StoreForm({
  routes,
  store,
  action,
}: {
  routes: DeliveryRoute[];
  store?: Store;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      {store && <input type="hidden" name="id" value={store.id} />}

      <div>
        <Label htmlFor="name">Nome da loja</Label>
        <Input id="name" name="name" defaultValue={store?.name} required />
      </div>

      <div>
        <Label htmlFor="route_id">Rota</Label>
        <Select id="route_id" name="route_id" defaultValue={store?.route_id} required>
          <option value="" disabled>
            Selecione uma rota
          </option>
          {routes.map((route) => (
            <option key={route.id} value={route.id}>
              {route.name}
            </option>
          ))}
        </Select>
      </div>

      {store && (
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" name="active" defaultChecked={store.active} />
          Loja ativa
        </label>
      )}

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : store ? "Salvar alterações" : "Cadastrar loja"}
      </Button>
    </form>
  );
}
