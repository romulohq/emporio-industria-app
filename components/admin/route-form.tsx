"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createRoute, type FormState } from "@/app/(app)/admin/rotas/actions";
import type { ProductionUnit } from "@/lib/types/database.types";

const initialState: FormState = undefined;

export function RouteForm({
  units,
  defaultUnitId,
}: {
  units: ProductionUnit[];
  defaultUnitId?: string;
}) {
  const [state, formAction, pending] = useActionState(createRoute, initialState);

  return (
    <form action={formAction} className="flex items-end gap-3">
      <div className="flex-1">
        <label className="mb-1 block text-sm font-medium text-neutral-700" htmlFor="name">
          Nova rota
        </label>
        <Input id="name" name="name" placeholder="Ex: Rota 03" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700" htmlFor="unit_id">
          Unidade
        </label>
        <Select id="unit_id" name="unit_id" defaultValue={defaultUnitId} required>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Criando..." : "Criar rota"}
      </Button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
