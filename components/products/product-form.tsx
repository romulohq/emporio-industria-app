"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { unitOptionsFor } from "@/lib/format/units";
import type { FormState } from "@/app/(app)/produtos/actions";
import type { Product, Sector } from "@/lib/types/database.types";

const initialState: FormState = undefined;

type Kind = "product" | "subproduct" | "raw_material";

const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: "product", label: "Produto" },
  { value: "subproduct", label: "Subproduto (SP)" },
  { value: "raw_material", label: "Matéria-prima (MP)" },
];

export function ProductForm({
  sectors,
  unitNames = {},
  product,
  action,
}: {
  sectors: Sector[];
  /** production unit names by id, used in the warning when the sector moves to another unit */
  unitNames?: Record<string, string>;
  product?: Product;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [kind, setKind] = useState<Kind>("product");
  const [name, setName] = useState(product?.name ?? "");
  const isProduct = kind === "product";
  const [sectorId, setSectorId] = useState(product?.sector_id ?? "");
  // moving an existing product to a sector of ANOTHER unit takes it out of the other unit's lists
  // (e.g. leaving Fábrica Osório removes it from the frozen stock count)
  const unitOf = (id: string) => sectors.find((s) => s.id === id)?.unit_id ?? null;
  const originalUnit = product ? unitOf(product.sector_id) : null;
  const newUnit = sectorId ? unitOf(sectorId) : null;
  const changesUnit = isProduct && !!product && !!sectorId && originalUnit !== newUnit;
  const unitMessage = changesUnit
    ? `Este setor é da unidade "${newUnit ? (unitNames[newUnit] ?? "outra unidade") : "outra unidade"}", e o produto hoje é de "${originalUnit ? (unitNames[originalUnit] ?? "outra unidade") : "outra unidade"}". Ao salvar, ele sai das listas da unidade atual (por exemplo, da contagem de congelados da Fábrica Osório).`
    : null;
  const prefix = kind === "subproduct" ? "SP" : "MP";
  const alreadyPrefixed = new RegExp(`^${prefix}\\s`, "i").test(name.trim());
  const resultName = alreadyPrefixed ? name.trim() : `${prefix} ${name.trim()}`;

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (unitMessage && !window.confirm(`${unitMessage}\n\nConfirmar a mudança de setor?`)) e.preventDefault();
      }}
      className="max-w-lg space-y-4"
    >
      {product && <input type="hidden" name="id" value={product.id} />}

      <div>
        <Label htmlFor="kind">Tipo do cadastro</Label>
        <Select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        {!isProduct && (
          <p className="mt-1.5 rounded-md bg-orange-50 px-3 py-2 text-xs text-orange-800">
            {product ? (
              <>
                Ao salvar, este item <b>sai de Produtos</b> e passa a existir em{" "}
                {kind === "subproduct" ? "Subprodutos" : "Matéria-prima"} com o nome{" "}
                <b>{name.trim() ? resultName : `${prefix} NOME`}</b>.
                {kind === "subproduct" ? " A ficha técnica dele, se houver, vai junto." : ""} O histórico de
                contagens e pedidos é mantido.
              </>
            ) : (
              <>
                Será cadastrado em {kind === "subproduct" ? "Subprodutos" : "Matéria-prima"} com o nome{" "}
                <b>{name.trim() ? resultName : `${prefix} NOME`}</b>, e não em Produtos.
              </>
            )}
          </p>
        )}
      </div>

      {isProduct && (
        <div>
          <Label htmlFor="sector_id">Setor</Label>
          <Select
            id="sector_id"
            name="sector_id"
            value={sectorId}
            onChange={(e) => setSectorId(e.target.value)}
            required
          >
            <option value="" disabled>
              Selecione um setor
            </option>
            {sectors.map((sector) => (
              <option key={sector.id} value={sector.id}>
                {sector.name}
              </option>
            ))}
          </Select>
          {unitMessage && (
            <p className="mt-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">{unitMessage}</p>
          )}
        </div>
      )}

      <div>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="sku">{kind === "raw_material" ? "Código (opcional)" : "SKU (opcional)"}</Label>
          <Input id="sku" name="sku" defaultValue={product?.sku ?? ""} />
        </div>
        <div>
          <Label htmlFor="unit">Unidade</Label>
          <Select id="unit" name="unit" defaultValue={product?.unit ?? "und"} required>
            {unitOptionsFor(product?.unit).map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isProduct && (
        <>
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
        </>
      )}

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending
          ? "Salvando..."
          : !isProduct
            ? product
              ? `Converter em ${kind === "subproduct" ? "subproduto" : "matéria-prima"}`
              : `Cadastrar ${kind === "subproduct" ? "subproduto" : "matéria-prima"}`
            : product
              ? "Salvar alterações"
              : "Cadastrar produto"}
      </Button>
    </form>
  );
}
