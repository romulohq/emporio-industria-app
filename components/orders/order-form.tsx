"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createOrder, type FormState } from "@/app/(app)/pedidos/actions";
import { PRIORITY_LABELS, PRIORITY_ORDER } from "@/lib/format/labels";
import type { Product, Sector } from "@/lib/types/database.types";

const initialState: FormState = undefined;

export function OrderForm({
  products,
  sectorsById,
}: {
  products: Product[];
  sectorsById: Record<string, Sector>;
}) {
  const [state, formAction, pending] = useActionState(createOrder, initialState);

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <div>
        <Label htmlFor="product_id">Produto</Label>
        <Select id="product_id" name="product_id" required defaultValue="">
          <option value="" disabled>
            Selecione um produto
          </option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} ({sectorsById[product.sector_id]?.name ?? "—"})
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="quantity">Quantidade</Label>
          <Input id="quantity" name="quantity" type="number" step="0.001" min={0.001} required />
        </div>
        <div>
          <Label htmlFor="priority">Prioridade</Label>
          <Select id="priority" name="priority" defaultValue="medium" required>
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Observações (opcional)</Label>
        <Input id="notes" name="notes" />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Criando..." : "Criar ordem de produção"}
      </Button>
    </form>
  );
}
