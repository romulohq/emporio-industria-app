"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calculator, ListTree, Plus, Printer, Trash2, Layers, Check, Package } from "lucide-react";
import { createSubproduct, saveRecipe } from "@/app/(app)/produtos/fichas/actions";
import { createRawMaterial } from "@/app/(app)/produtos/materias-primas/actions";
import { RecipeTree } from "@/components/recipes/recipe-tree";
import { RecipePrintSheet } from "@/components/recipes/recipe-print-sheet";
import { buildTree, type RecipeLine, type SubproductRecipe } from "@/lib/recipes/tree";
import { autoYield } from "@/lib/recipes/yield";

type DraftLine = {
  key: string;
  /** raw material (name typed/picked), subproduct, or a loose text input from before raw materials existed */
  kind: "raw" | "subproduct" | "ingredient";
  name: string;
  subproductId: string;
  quantity: string;
  unit: string;
};

const UNITS = ["kg", "g", "L", "mL", "und", "pct", "cx"];

let counter = 0;
const nextKey = () => `l${++counter}`;
const toNumber = (v: string) => Number(v.trim().replace(",", "."));
const matchKey = (s: string) => s.trim().toLowerCase();
const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n);

const field =
  "w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-base focus:border-orange-600 focus:outline-none focus:ring-1 focus:ring-orange-600 disabled:bg-neutral-50 sm:text-sm";

export function RecipeEditor({
  owner,
  ownerName,
  ownerCode,
  ownerUnit,
  ownerKind,
  initialYieldQuantity,
  initialYieldUnit,
  initialInstructions,
  initialLines,
  subproducts: subproductsProp,
  rawMaterials,
  subRecipes,
  canEdit,
}: {
  owner: { productId: string } | { subproductId: string };
  ownerName: string;
  /** shown on the printed sheet: SKU, unit of measure and the sector (or "Produto intermediário") */
  ownerCode: string | null;
  ownerUnit: string;
  ownerKind: string;
  initialYieldQuantity: number | null;
  initialYieldUnit: string;
  initialInstructions: string;
  initialLines: RecipeLine[];
  /** subproducts that can be used as ingredient (never the recipe's own subproduct) */
  subproducts: { id: string; name: string; unit: string }[];
  /** registered raw materials the lines can point to */
  rawMaterials: { id: string; name: string; unit: string }[];
  subRecipes: Record<string, SubproductRecipe>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const ownerSubproductId = "subproductId" in owner ? owner.subproductId : null;
  const [view, setView] = useState<"edit" | "tree" | "scale">("edit");
  // scaling: which quantity the user is fixing ("yield", a line key, or a plain factor) and how much of it
  const [scaleBase, setScaleBase] = useState<string>(initialYieldQuantity ? "yield" : "factor");
  const [scaleValue, setScaleValue] = useState("");
  const [printedAt, setPrintedAt] = useState("");
  useEffect(() => {
    const stamp = () =>
      setPrintedAt(
        new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short" }).format(
          new Date()
        )
      );
    window.addEventListener("beforeprint", stamp);
    return () => window.removeEventListener("beforeprint", stamp);
  }, []);
  const [yieldQuantity, setYieldQuantity] = useState(initialYieldQuantity === null ? "" : String(initialYieldQuantity));
  const [yieldUnit, setYieldUnit] = useState(initialYieldUnit);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [lines, setLines] = useState<DraftLine[]>(() =>
    initialLines.map((l) => ({
      key: nextKey(),
      kind: l.subproductId ? "subproduct" : l.rawMaterialId ? "raw" : "ingredient",
      name: l.name ?? "",
      subproductId: l.subproductId ?? "",
      quantity: String(l.quantity),
      unit: l.unit,
    }))
  );
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // subprodutos cadastrados aqui mesmo, antes de a lista da página ser recarregada
  const [spCreated, setSpCreated] = useState<{ id: string; name: string; unit: string }[]>([]);
  const subproducts = useMemo(() => {
    const ids = new Set(subproductsProp.map((s) => s.id));
    return [...subproductsProp, ...spCreated.filter((s) => !ids.has(s.id))];
  }, [subproductsProp, spCreated]);

  // formulário rápido "Cadastrar subproduto"
  const [newSp, setNewSp] = useState<{ name: string; unit: string } | null>(null);
  const [newSpError, setNewSpError] = useState<string | null>(null);
  const [newSpPending, startNewSp] = useTransition();
  function saveNewSp(e: React.FormEvent) {
    e.preventDefault();
    if (!newSp) return;
    setNewSpError(null);
    const wanted = newSp.name.trim().toLowerCase();
    if (subproducts.some((sp) => sp.name.trim().toLowerCase() === wanted)) {
      setNewSpError("Já existe um subproduto com esse nome.");
      return;
    }
    startNewSp(async () => {
      const result = await createSubproduct({ name: newSp.name, unit: newSp.unit });
      if (result.error || !result.id) {
        setNewSpError(result.error ?? "Não foi possível cadastrar.");
        return;
      }
      const created = { id: result.id, name: newSp.name.trim(), unit: newSp.unit.trim() };
      setSpCreated((prev) => [...prev, created]);
      // já coloca o subproduto na ficha, numa linha de subproduto vazia ou numa nova
      const target = lines.find((l) => l.kind === "subproduct" && l.subproductId === "");
      if (target) update(target.key, { subproductId: created.id, ...(target.quantity ? {} : { unit: created.unit }) });
      else {
        const key = add("subproduct");
        update(key, { subproductId: created.id, unit: created.unit });
        focusIngredient(key);
      }
      setNewSp(null);
      router.refresh();
    });
  }

  // matérias-primas cadastradas aqui mesmo, antes de a lista da página ser recarregada
  const [justCreated, setJustCreated] = useState<{ id: string; name: string; unit: string }[]>([]);
  const allRawMaterials = useMemo(() => {
    const seen = new Set(rawMaterials.map((m) => matchKey(m.name)));
    return [...rawMaterials, ...justCreated.filter((m) => !seen.has(matchKey(m.name)))];
  }, [rawMaterials, justCreated]);
  const rawByName = useMemo(() => new Map(allRawMaterials.map((m) => [matchKey(m.name), m])), [allRawMaterials]);

  // formulário rápido "Cadastrar matéria-prima"
  const [newMp, setNewMp] = useState<{ name: string; unit: string; category: "geral" | "hortifruti"; code: string } | null>(null);
  const [newMpError, setNewMpError] = useState<string | null>(null);
  const [newMpPending, startNewMp] = useTransition();
  function openNewMp() {
    // aproveita o nome já digitado numa linha que ainda não é uma matéria-prima cadastrada
    const typed = lines.find((l) => l.kind === "raw" && l.name.trim() !== "" && !rawByName.has(matchKey(l.name)));
    setNewMpError(null);
    setNewMp({ name: typed?.name.trim() ?? "", unit: typed?.unit.trim() || "kg", category: "geral", code: "" });
  }
  function saveNewMp(e: React.FormEvent) {
    e.preventDefault();
    if (!newMp) return;
    setNewMpError(null);
    if (rawByName.has(matchKey(newMp.name))) {
      setNewMpError("Já existe uma matéria-prima com esse nome.");
      return;
    }
    startNewMp(async () => {
      const result = await createRawMaterial(newMp);
      if (result.error || !result.created) {
        setNewMpError(result.error ?? "Não foi possível cadastrar.");
        return;
      }
      const created = result.created;
      setJustCreated((prev) => [...prev, created]);
      // coloca a matéria-prima na ficha: na linha que tinha o nome digitado, numa linha vazia ou numa nova
      const target =
        lines.find((l) => l.kind === "raw" && matchKey(l.name) === matchKey(created.name)) ??
        lines.find((l) => l.kind === "raw" && l.name.trim() === "");
      if (target) update(target.key, { name: created.name, ...(target.quantity ? {} : { unit: created.unit }) });
      else {
        const key = add("raw");
        update(key, { name: created.name, unit: created.unit });
        focusIngredient(key);
      }
      setNewMp(null);
      router.refresh();
    });
  }

  function update(key: string, patch: Partial<DraftLine>) {
    setMessage(null);
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function add(kind: DraftLine["kind"]): string {
    setMessage(null);
    const key = nextKey();
    setLines((prev) => [...prev, { key, kind, name: "", subproductId: "", quantity: "", unit: "kg" }]);
    return key;
  }
  function focusIngredient(key: string) {
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-line-name="${key}"]`)?.focus());
  }
  /** Enter in the quantity or unit of a complete line: go to the next line, or start a new one after the last. */
  function enterOnLine(e: React.KeyboardEvent, line: DraftLine) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (!canEdit || !(toNumber(line.quantity) > 0) || line.unit.trim() === "") return;
    const next = lines[lines.findIndex((l) => l.key === line.key) + 1];
    focusIngredient(next ? next.key : add("raw"));
  }
  function remove(key: string) {
    setMessage(null);
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  /** The draft as recipe lines; incomplete rows are left out of the tree and block the save. */
  const validLines = useMemo(
    () =>
      lines
        .map((l) => {
          const raw = l.kind === "raw" ? rawByName.get(matchKey(l.name)) : undefined;
          return {
            name: l.kind === "subproduct" ? null : (raw?.name ?? l.name.trim()),
            subproductId: l.kind === "subproduct" ? l.subproductId : null,
            rawMaterialId: raw?.id ?? null,
            quantity: toNumber(l.quantity),
            unit: l.unit.trim(),
          };
        })
        .filter(
          (l) =>
            Number.isFinite(l.quantity) &&
            l.quantity > 0 &&
            l.unit !== "" &&
            (l.rawMaterialId ? true : l.name ? l.name.length > 0 : !!l.subproductId)
        ),
    [lines, rawByName]
  );

  // rendimento digitado; sem ele vale a soma dos ingredientes (nada é gravado: a ficha segue "sem rendimento")
  const manualYield = yieldQuantity.trim() === "" ? null : toNumber(yieldQuantity);
  const auto = useMemo(() => autoYield(validLines), [validLines]);
  const usingAuto = manualYield === null && auto !== null;
  const yieldNumber = manualYield !== null ? manualYield : (auto?.quantity ?? null);
  const effectiveYieldUnit = usingAuto ? "kg" : yieldUnit;
  const yieldText = yieldNumber && yieldNumber > 0 ? `${fmt(yieldNumber)} ${effectiveYieldUnit}`.trim() : null;
  const tree = useMemo(
    () => buildTree(validLines, subRecipes, ownerSubproductId ? [ownerSubproductId] : []),
    [validLines, subRecipes, ownerSubproductId]
  );

  // --- scaling: every quantity is multiplied by (wanted / base) ---
  const subNames = useMemo(() => Object.fromEntries(subproducts.map((sp) => [sp.id, sp.name])), [subproducts]);
  const baseOptions = useMemo(
    () =>
      lines.flatMap((l) => {
        const quantity = toNumber(l.quantity);
        const label =
          l.kind === "subproduct" ? (subNames[l.subproductId] ?? "") : (rawByName.get(matchKey(l.name))?.name ?? l.name.trim());
        if (!label || !Number.isFinite(quantity) || quantity <= 0 || l.unit.trim() === "") return [];
        return [{ key: l.key, label, quantity, unit: l.unit.trim() }];
      }),
    [lines, subNames, rawByName]
  );
  const wanted = toNumber(scaleValue);
  const baseLine = baseOptions.find((o) => o.key === scaleBase);
  let baseQuantity: number | null = null;
  if (scaleBase === "factor") baseQuantity = 1;
  else if (scaleBase === "yield") baseQuantity = yieldNumber && yieldNumber > 0 ? yieldNumber : null;
  else baseQuantity = baseLine?.quantity ?? null;
  const factor =
    scaleValue.trim() !== "" && Number.isFinite(wanted) && wanted > 0 && baseQuantity ? wanted / baseQuantity : null;
  const appliedFactor = factor ?? 1;
  const scaleUnit = scaleBase === "factor" ? "×" : scaleBase === "yield" ? effectiveYieldUnit : (baseLine?.unit ?? "");
  const scaleText =
    factor === null || factor === 1
      ? null
      : scaleBase === "factor"
        ? `fator ${fmt(factor)}×`
        : scaleBase === "yield"
          ? `${fmt(wanted)} ${effectiveYieldUnit} de rendimento · fator ${fmt(factor)}×`
          : `${fmt(wanted)} ${scaleUnit} de ${baseLine?.label} · fator ${fmt(factor)}×`;

  const scaledRows = useMemo(() => {
    const scaledLines = validLines.map((l) => ({ ...l, quantity: l.quantity * appliedFactor }));
    const nodes = buildTree(scaledLines, subRecipes, ownerSubproductId ? [ownerSubproductId] : []);
    return nodes.map((node, i) => ({ node, baseQuantity: validLines[i].quantity }));
  }, [validLines, appliedFactor, subRecipes, ownerSubproductId]);
  const scaledYieldText =
    yieldNumber && yieldNumber > 0 ? `${fmt(yieldNumber * appliedFactor)} ${effectiveYieldUnit}`.trim() : null;

  function save() {
    if (validLines.length !== lines.length) {
      setMessage({
        ok: false,
        text: "Há linhas incompletas: informe o ingrediente (ou o subproduto), a quantidade e a unidade, ou remova a linha.",
      });
      return;
    }
    if (yieldQuantity.trim() !== "" && !(manualYield && manualYield > 0)) {
      setMessage({ ok: false, text: "O rendimento precisa ser um número maior que zero." });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await saveRecipe({
        product_id: "productId" in owner ? owner.productId : null,
        subproduct_id: ownerSubproductId,
        yield_quantity: manualYield,
        yield_unit: yieldUnit.trim(),
        instructions,
        items: validLines.map((l) => ({
          name: l.rawMaterialId ? null : l.name,
          subproduct_id: l.subproductId,
          raw_material_id: l.rawMaterialId,
          quantity: l.quantity,
          unit: l.unit,
        })),
      });
      setMessage(result.error ? { ok: false, text: result.error } : { ok: true, text: "Ficha técnica salva." });
      // new raw materials created by this save show up in the suggestions right away
      if (!result.error) router.refresh();
    });
  }

  return (
    <>
    <div className="space-y-4 print:hidden">
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
          <button
            type="button"
            onClick={() => setView("scale")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${view === "scale" ? "bg-orange-600 text-white" : "text-neutral-600 hover:bg-neutral-50"}`}
          >
            <Calculator className="h-4 w-4" />
            Escala
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <Printer className="h-4 w-4" />
            Imprimir ficha
          </button>
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
      </div>

      {message && (
        <p className={`flex items-center gap-1.5 text-sm ${message.ok ? "text-green-700" : "text-red-600"}`}>
          {message.ok && <Check className="h-4 w-4" />}
          {message.text}
        </p>
      )}

      {view === "scale" ? (
        <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Escalonamento da receita</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Calcule a receita para a quantidade que você quer produzir. Escolha a quantidade que será a base e
              informe quanto precisa: todos os outros ingredientes são recalculados na mesma proporção, e a ficha é
              impressa já com os valores ajustados.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
            <label className="block text-xs font-medium text-neutral-600">
              Base do cálculo
              <select
                value={scaleBase}
                onChange={(e) => setScaleBase(e.target.value)}
                className={`${field} mt-1`}
              >
                <option value="yield" disabled={!(yieldNumber && yieldNumber > 0)}>
                  {yieldNumber && yieldNumber > 0
                    ? `${usingAuto ? "Rendimento automático, soma dos ingredientes" : "Rendimento da receita"} (${fmt(yieldNumber)} ${effectiveYieldUnit})`.trim()
                    : "Rendimento da receita (informe na aba Ficha)"}
                </option>
                {baseOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label} ({fmt(o.quantity)} {o.unit})
                  </option>
                ))}
                <option value="factor">Fator de multiplicação (×)</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-neutral-600">
              {scaleBase === "factor" ? "Multiplicar por" : "Quantidade desejada"}
              <div className="relative mt-1">
                <input
                  value={scaleValue}
                  onChange={(e) => setScaleValue(e.target.value)}
                  inputMode="decimal"
                  placeholder={scaleBase === "factor" ? "Ex.: 2,5" : "Ex.: 10"}
                  className={`${field} pr-12 text-right`}
                />
                {scaleUnit && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">
                    {scaleUnit}
                  </span>
                )}
              </div>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-orange-50 px-3 py-2 text-sm">
            <span className="text-orange-900">
              Fator de escala: <b>{fmt(appliedFactor)}×</b>
              {factor === null && <span className="ml-2 text-xs text-orange-700/80">(informe a quantidade para recalcular)</span>}
            </span>
            {scaledYieldText && (
              <span className="text-orange-900">
                Rendimento: <b>{scaledYieldText}</b>
              </span>
            )}
          </div>

          {scaledRows.length === 0 ? (
            <p className="text-sm text-neutral-500">Adicione ingredientes na aba Ficha para calcular.</p>
          ) : (
            <div className="overflow-hidden rounded-md border border-neutral-200">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Ingrediente</th>
                    <th className="px-3 py-2 text-right">Quantidade</th>
                    <th className="px-3 py-2 text-right">Receita base</th>
                  </tr>
                </thead>
                <tbody>
                  {scaledRows.map(({ node, baseQuantity: base }, index) => (
                    <tr key={`${node.label}-${index}`} className="border-t border-neutral-100">
                      <td className="px-3 py-1.5 text-neutral-900">
                        {node.label}
                        {node.subproductId && (
                          <span className="ml-1.5 rounded bg-orange-100 px-1 py-px text-[9px] font-bold uppercase text-orange-700">
                            SP
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-neutral-900">
                        {fmt(node.quantity)} {node.unit}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-neutral-400">
                        {fmt(base)} {node.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            <Printer className="h-4 w-4" />
            Imprimir ficha {scaleText ? "nesta quantidade" : "(receita base)"}
          </button>
        </section>
      ) : view === "tree" ? (
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
                placeholder={auto ? `Automático: ${fmt(auto.quantity)}` : "Quantidade"}
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
            {usingAuto && auto && (
              <p className="mt-1.5 rounded-md bg-orange-50 px-2.5 py-1.5 text-xs text-orange-900">
                Rendimento não informado: vale a soma dos ingredientes, <b>{fmt(auto.quantity)} kg</b>
                {auto.ignored > 0
                  ? ` (${auto.ignored} ${auto.ignored === 1 ? "item em unidade ficou" : "itens em unidade ficaram"} fora da soma)`
                  : ""}
                . Litros contam como quilos. Digite um valor acima para usar outro.
              </p>
            )}
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">Ingredientes</h2>
            {lines.length === 0 && <p className="mb-3 text-sm text-neutral-500">Nenhum ingrediente ainda.</p>}
            <div className="space-y-2">
              {lines.map((line) => (
                <div key={line.key} className="grid grid-cols-[1fr_5.5rem_5rem_2rem] items-center gap-2">
                  {line.kind === "raw" ? (
                    <input
                      value={line.name}
                      onChange={(e) => {
                        const match = rawByName.get(matchKey(e.target.value));
                        update(line.key, { name: e.target.value, ...(match && !line.quantity ? { unit: match.unit } : {}) });
                      }}
                      list="recipe-raw-materials"
                      data-line-name={line.key}
                      placeholder="Ingrediente (digite para buscar ou cadastrar)"
                      aria-label="Ingrediente"
                      disabled={!canEdit}
                      className={field}
                    />
                  ) : line.kind === "ingredient" ? (
                    <input
                      value={line.name}
                      onChange={(e) => update(line.key, { name: e.target.value })}
                      data-line-name={line.key}
                      placeholder="Insumo"
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
                        data-line-name={line.key}
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
                    onKeyDown={(e) => enterOnLine(e, line)}
                    inputMode="decimal"
                    placeholder="Qtd."
                    aria-label="Quantidade"
                    disabled={!canEdit}
                    className={`${field} text-right`}
                  />
                  <input
                    value={line.unit}
                    onChange={(e) => update(line.key, { unit: e.target.value })}
                    onKeyDown={(e) => enterOnLine(e, line)}
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
                  onClick={() => add("raw")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar ingrediente
                </button>
                <button
                  type="button"
                  onClick={() => add("subproduct")}
                  disabled={subproducts.length === 0}
                  title={subproducts.length === 0 ? "Ainda não há subprodutos: use Cadastrar subproduto" : undefined}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Adicionar subproduto (SP)
                </button>
                <button
                  type="button"
                  onClick={() => (newMp ? setNewMp(null) : openNewMp())}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  <Package className="h-3.5 w-3.5" />
                  Cadastrar matéria-prima
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewSpError(null);
                    setNewSp(newSp ? null : { name: "SP ", unit: "kg" });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Cadastrar subproduto
                </button>
              </div>
            )}
            {canEdit && newSp && (
              <form onSubmit={saveNewSp} className="mt-3 rounded-lg border border-orange-200 bg-orange-50/40 p-3">
                <p className="mb-2 text-xs font-semibold text-neutral-800">Novo subproduto</p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={newSp.name}
                    onChange={(e) => setNewSp({ ...newSp, name: e.target.value })}
                    placeholder="Nome (ex.: SP Cebola caramelizada)"
                    aria-label="Nome do subproduto"
                    autoFocus
                    className={`${field} min-w-52 flex-1`}
                  />
                  <input
                    value={newSp.unit}
                    onChange={(e) => setNewSp({ ...newSp, unit: e.target.value })}
                    list="recipe-units"
                    aria-label="Unidade"
                    className={`${field} w-20`}
                  />
                  <button
                    type="submit"
                    disabled={newSpPending || newSp.name.trim().length < 2 || newSp.unit.trim() === ""}
                    className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                  >
                    {newSpPending ? "Cadastrando..." : "Cadastrar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSp(null)}
                    className="rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-200"
                  >
                    Cancelar
                  </button>
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  O subproduto entra nesta ficha. Depois, em Produtos &gt; Subprodutos, você cadastra a ficha dele.
                </p>
                {newSpError && <p className="mt-1 text-xs font-medium text-red-600">{newSpError}</p>}
              </form>
            )}
            {canEdit && newMp && (
              <form onSubmit={saveNewMp} className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <p className="mb-2 text-xs font-semibold text-neutral-800">Nova matéria-prima</p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={newMp.name}
                    onChange={(e) => setNewMp({ ...newMp, name: e.target.value })}
                    placeholder="Nome (ex.: Requeijão bisnaga)"
                    aria-label="Nome da matéria-prima"
                    autoFocus
                    className={`${field} min-w-52 flex-1`}
                  />
                  <input
                    value={newMp.unit}
                    onChange={(e) => setNewMp({ ...newMp, unit: e.target.value })}
                    list="recipe-units"
                    aria-label="Unidade"
                    className={`${field} w-20`}
                  />
                  <select
                    value={newMp.category}
                    onChange={(e) => setNewMp({ ...newMp, category: e.target.value as "geral" | "hortifruti" })}
                    aria-label="Categoria"
                    className={`${field} w-36`}
                  >
                    <option value="geral">Geral</option>
                    <option value="hortifruti">Hortifruti</option>
                  </select>
                  <input
                    value={newMp.code}
                    onChange={(e) => setNewMp({ ...newMp, code: e.target.value })}
                    placeholder="Código (opcional)"
                    aria-label="Código"
                    className={`${field} w-36`}
                  />
                  <button
                    type="submit"
                    disabled={newMpPending || newMp.name.trim().length < 2 || newMp.unit.trim() === ""}
                    className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                  >
                    {newMpPending ? "Cadastrando..." : "Cadastrar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewMp(null)}
                    className="rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-200"
                  >
                    Cancelar
                  </button>
                </div>
                {newMpError && <p className="mt-2 text-xs font-medium text-red-600">{newMpError}</p>}
              </form>
            )}
            <p className="mt-2 text-xs text-neutral-500">
              Ao digitar, aparecem as matérias-primas já cadastradas. Um ingrediente novo é cadastrado como matéria-prima
              ao salvar a ficha.{" "}
              <Link href="/produtos/materias-primas" className="font-medium text-orange-700 hover:underline">
                Ver matérias-primas
              </Link>
            </p>
            <datalist id="recipe-raw-materials">
              {allRawMaterials.map((m) => (
                <option key={m.id} value={m.name} />
              ))}
            </datalist>
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

    <RecipePrintSheet
      title={ownerName}
      code={ownerCode}
      unitLabel={ownerUnit}
      kind={ownerKind}
      scaleText={scaleText}
      yieldText={scaledYieldText}
      nodes={scaledRows.map((r) => r.node)}
      instructions={instructions}
      printedAt={printedAt}
    />
    </>
  );
}
