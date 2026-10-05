"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { FormState } from "@/app/(app)/produtos/actions";
import type { Product, Sector } from "@/lib/types/database.types";

const initialState: FormState = undefined;

export function ProductForm({
  sectors,
  product,
  action,
}: {
  sectors: Sector[];
  product?: Product;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      {product && <input type="hidden" name="id" value={product.id} />}

      <div>
        <Label htmlFor="sector_id">Setor</Label>
        <Select id="sector_id" name="sector_id" defaultValue={product?.sector_id} required>
          <option value="" disabled>
            Selecione um setor
          </option>
          {sectors.map((sector) => (
            <option key={sector.id} value={sector.id}>
              {sector.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="name">Nome do produto</Label>
        <Input id="name" name="name" defaultValue={product?.name} required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="sku">SKU (opcional)</Label>
          <Input id="sku" name="sku" defaultValue={product?.sku ?? ""} />
        </div>
        <div>
          <Label htmlFor="unit">Unidade</Label>
          <Input id="unit" name="unit" defaultValue={product?.unit ?? "und"} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="min_quantity">Estoque mínimo</Label>
          <Input
            id="min_quantity"
            name="min_quantity"
            type="number"
            step="0.001"
            min={0}
            defaultValue={product?.min_quantity ?? 0}
            required
          />
        </div>
        <div>
          <Label htmlFor="units_per_box">Unidades por caixa</Label>
          <Input
            id="units_per_box"
            name="units_per_box"
            type="number"
            step="0.001"
            min={0.001}
            defaultValue={product?.units_per_box ?? 1}
            required
          />
        </div>
        {!product && (
          <div>
            <Label htmlFor="current_quantity">Estoque inicial</Label>
            <Input
              id="current_quantity"
              name="current_quantity"
              type="number"
              step="0.001"
              min={0}
              defaultValue={0}
            />
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="production_group">Grupo de produção (opcional)</Label>
        <Input
          id="production_group"
          name="production_group"
          type="number"
          step="1"
          min={1}
          defaultValue={product?.production_group ?? ""}
        />
        <p className="mt-1 text-xs text-neutral-500">
          Agrupa este produto na ordem de produção impressa (ex: 1, 2, 3 — um número por colaborador).
        </p>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : product ? "Salvar alterações" : "Cadastrar produto"}
      </Button>
    </form>
  );
}
