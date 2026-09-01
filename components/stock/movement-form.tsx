"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createMovement, type FormState } from "@/app/(app)/estoque/actions";
import { MOVEMENT_LABELS, MOVEMENT_ORDER } from "@/lib/format/labels";
import type { Product } from "@/lib/types/database.types";

const initialState: FormState = undefined;

export function MovementForm({ product }: { product: Product }) {
  const [state, formAction, pending] = useActionState(createMovement, initialState);

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <input type="hidden" name="product_id" value={product.id} />

      <div>
        <Label htmlFor="movement_type">Tipo</Label>
        <Select id="movement_type" name="movement_type" defaultValue="entry" required>
          {MOVEMENT_ORDER.map((type) => (
            <option key={type} value={type}>
              {MOVEMENT_LABELS[type]}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="quantity">
          Quantidade ({product.unit})
        </Label>
        <Input id="quantity" name="quantity" type="number" step="0.001" required />
        <p className="mt-1 text-xs text-neutral-500">
          Para Entrada e Saída, informe um valor positivo — o sinal é aplicado automaticamente.
          Para Ajuste, use um valor negativo para remover do estoque.
        </p>
      </div>

      <div>
        <Label htmlFor="reason">Motivo</Label>
        <Input id="reason" name="reason" placeholder="Ex: compra, perda, contagem de inventário" required />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Registrando..." : "Registrar movimentação"}
      </Button>
    </form>
  );
}
