"use client";

import { useMemo, useState, useTransition } from "react";
import { ListTree, Plus, Trash2, Layers, Check } from "lucide-react";
import { saveRecipe } from "@/app/(app)/produtos/fichas/actions";
import { RecipeTree } from "@/components/recipes/recipe-tree";
import { buildTree, type RecipeLine, type SubproductRecipe } from "@/lib/recipes/tree";

type DraftLine = {
  key: string;
  kind: "ingredient" | "subproduct";
  name: string;
  subproductId: string;
  quantity: string;
  unit: string;
};

const UNITS = ["kg", "g", "L", "mL", "und", "pct", "cx"];

let counter = 0;
const nextKey = () => `l${++counter}`;
const toNumber = (v: string) => Number(v.trim().replace(",", "."));
const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n);

const field =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-base focus:border-orange-600 focus:outline-none focus:ring-1 focus:ring-orange-600 disabled:bg-neutral-50 sm:text-sm";

export function RecipeEditor({
  owner,
  ownerName,
  initialYieldQuantity,
  initialYieldUnit,
  initialInstructions,
  initialLines,
  subproducts,
  subRecipes,
  canEdit,
}: {
  owner: { productId: string } | { subproductId: string };
  ownerName: string;
  initialYieldQuantity: number | null;
  initialYieldUnit: string;
  initialInstructions: string;
  initialLines: RecipeLine[];
  /** subproducts that can be used as ingredient (never the recipe's own subproduct) */
  subproducts: { id: string; name: string; unit: string }[];
  subRecipes: Record<string, SubproductRecipe>;
  canEdit: boolean;
}) {
  const ownerSubproductId = "subproductId" in owner ? owner.subproductId : null;
  const [view, setView] = useState<"edit" | "tree">("edit");
  const [yieldQuantity, setYieldQuantity] = useState(initialYieldQuantity === null ? "" : String(initialYieldQuantity));
  const [yieldUnit, setYieldUnit] = useState(initialYieldUnit);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [lines, setLines] = useState<DraftLine[]>(() =>
    initialLines.map((l) => ({
      key: nextKey(),
      kind: l.subproductId ? "subproduct" : "ingredient",
      name: l.name ?? "",
      subproductId: l.subproductId ?? "",
      quantity: String(l.quantity),
      unit: l.unit,
    }))
  );
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function update(key: string, patch: Partial<DraftLine>) {
    setMessage(null);
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function add(kind: DraftLine["kind"]) {
    setMessage(null);
    setLines((prev) => [...prev, { key: nextKey(), kind, name: "", subproductId: "", quantity: "", unit: "kg" }]);
  }
  function remove(key: string) {
    setMessage(null);
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  /** The draft as recipe lines; incomplete rows are left out of the tree and block the save. */
  const validLines = useMemo(
    () =>
      lines
        .map((l) => ({
          name: l.kind === "ingredient" ? l.name.trim() : null,
          subproductId: l.kind === "subproduct" ? l.subproductId : null,
          quantity: toNumber(l.quantity),
          unit: l.unit.trim(),
        }))
        .filter(
          (l) =>
            Number.isFinite(l.quantity) && l.quantity > 0 && l.unit !== "" && (l.name ? l.name.length > 0 : !!l.subproductId)
        ),
    [lines]
  );

  const yieldNumber = yieldQuantity.trim() === "" ? null : toNumber(yieldQuantity);
  const yieldText = yieldNumber && yieldNumber > 0 ? `${fmt(yieldNumber)} ${yieldUnit}`.trim() : null;
  const tree = useMemo(
    () => buildTree(validLines, subRecipes, ownerSubproductId ? [ownerSubproductId] : []),
    [validLines, subRecipes, ownerSubproductId]
  );

  function save() {
    if (validLines.length !== lines.length) {
      setMessage({ ok: false, text: "Há linhas incompletas: informe o item, a quantidade e a unidade (ou remova a linha)." });
      return;
    }
    if (yieldQuantity.trim() !== "" && !(yieldNumber && yieldNumber > 0)) {
      setMessage({ ok: false, text: "O rendimento precisa ser um número maior que zero." });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await saveRecipe({
        product_id: "productId" in owner ? owner.productId : null,
        subproduct_id: ownerSubproductId,
        yield_quantity: yieldNumber,
        yield_unit: yieldUnit.trim(),
        instructions,
        items: validLines.map((l) => ({
          name: l.name,
          subproduct_id: l.subproductId,
          quantity: l.quantity,
          unit: l.unit,
        })),
      });
      setMessage(result.error ? { ok: false, text: result.error } : { ok: true, text: "Ficha técnica salva." });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setView("edit")}
            className={`rounded-md px-3 py-1.5 font-medium ${view === "edit" ? "bg-orange-600 text-white" : "text-neutral-600 hover:bg-neutral-50"}`}
          >
            Ficha
          </button>
          <button
            type="button"
            onClick={() => setView("tree")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${view === "tree" ? "bg-orange-600 text-white" : "text-neutral-600 hover:bg-neutral-50"}`}
          >
            <ListTree className="h-4 w-4" />
            Árvore
          </button>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {pending ? "Salvando..." : "Salvar ficha"}
          </button>
        )}
      </div>

      {message && (
        <p className={`flex items-center gap-1.5 text-sm ${message.ok ? "text-green-700" : "text-red-600"}`}>
          {message.ok && <Check className="h-4 w-4" />}
          {message.text}
        </p>
      )}

      {view === "tree" ? (
        <RecipeTree title={ownerName} yieldText={yieldText} nodes={tree} />
      ) : (
        <>
          <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">Rendimento</h2>
            <div className="flex max-w-xs gap-2">
              <input
                value={yieldQuantity}
                onChange={(e) => {
                  setMessage(null);
                  setYieldQuantity(e.target.value);
                }}
                inputMode="decimal"
                placeholder="Quantidade"
                aria-label="Rendimento da receita"
                disabled={!canEdit}
                className={field}
              />
              <input
                value={yieldUnit}
                onChange={(e) => {
                  setMessage(null);
                  setYieldUnit(e.target.value);
                }}
                list="recipe-units"
                placeholder="Unidade"
                aria-label="Unidade do rendimento"
                disabled={!canEdit}
                className={`${field} w-28`}
              />
            </div>
            <p className="mt-1.5 text-xs text-neutral-500">
              Quanto a receita abaixo produz. É com ele que a árvore calcula as quantidades de um subproduto usado em
              outra ficha.
            </p>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">Ingredientes</h2>
            {lines.length === 0 && <p className="mb-3 text-sm text-neutral-500">Nenhum ingrediente ainda.</p>}
            <div className="space-y-2">
              {lines.map((line) => (
                <div key={line.key} className="grid grid-cols-[1fr_5.5rem_5rem_2rem] items-center gap-2">
                  {line.kind === "ingredient" ? (
                    <input
                      value={line.name}
                      onChange={(e) => update(line.key, { name: e.target.value })}
                      placeholder="Insumo (ex.: carne de sol)"
                      aria-label="Insumo"
                      disabled={!canEdit}
                      className={field}
                    />
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex shrink-0 items-center gap-1 rounded bg-orange-100 px-1.5 py-1 text-[10px] font-bold uppercase text-orange-700">
                        <Layers className="h-3 w-3" />
                        SP
                      </span>
                      <select
                        value={line.subproductId}
                        onChange={(e) => {
                          const sp = subproducts.find((s) => s.id === e.target.value);
                          update(line.key, { subproductId: e.target.value, ...(sp && !line.quantity ? { unit: sp.unit } : {}) });
                        }}
                        aria-label="Subproduto"
                        disabled={!canEdit}
                        className={field}
                      >
                        <option value="">Escolha o subproduto</option>
                        {subproducts.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <input
                    value={line.quantity}
                    onChange={(e) => update(line.key, { quantity: e.target.value })}
                    inputMode="decimal"
                    placeholder="Qtd."
                    aria-label="Quantidade"
                    disabled={!canEdit}
                    className={`${field} text-right`}
                  />
                  <input
                    value={line.unit}
                    onChange={(e) => update(line.key, { unit: e.target.value })}
                    list="recipe-units"
                    aria-label="Unidade"
                    disabled={!canEdit}
                    className={field}
                  />
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => remove(line.key)}
                      aria-label="Remover ingrediente"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
            {canEdit && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => add("ingredient")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar ingrediente
                </button>
                <button
                  type="button"
                  onClick={() => add("subproduct")}
                  disabled={subproducts.length === 0}
                  title={subproducts.length === 0 ? "Cadastre um subproduto na aba Subprodutos" : undefined}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Adicionar subproduto (SP)
                </button>
              </div>
            )}
            <datalist id="recipe-units">
              {UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <label htmlFor="recipe-instructions" className="mb-2 block text-sm font-semibold text-neutral-900">
              Modo de preparo
            </label>
            <textarea
              id="recipe-instructions"
              value={instructions}
              onChange={(e) => {
                setMessage(null);
                setInstructions(e.target.value);
              }}
              rows={5}
              disabled={!canEdit}
              className={`${field} resize-y`}
            />
          </section>
        </>
      )}
    </div>
  );
}
