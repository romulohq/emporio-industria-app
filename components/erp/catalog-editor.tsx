"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { parseBrNumber } from "@/lib/erp/br";
import type { ErpProductCatalogItem, ErpSector } from "@/lib/types/database.types";
import { registerPendingItems, saveCatalogItem, type CatalogInput } from "@/app/(app)/cadastro-produtos-erp/actions";

const SECTORS: ErpSector[] = ["Pães", "Salgados", "Folheados", "Cozinha"];

export type PendingProduct = {
  code: string;
  description: string;
  unitMeasure: "UNID" | "KG";
  suggestedWeightKg: number | null;
};

type Draft = {
  display_name: string;
  sector: ErpSector | "";
  group_name: string;
  unit_measure: "UNID" | "KG" | "";
  weight: string;
  active: boolean;
};

const field =
  "w-full rounded-md border border-neutral-300 px-2 py-1 text-sm focus:border-orange-600 focus:outline-none focus:ring-1 focus:ring-orange-600";

const weightText = (value: number | null) => (value == null ? "" : String(value).replace(".", ","));

/** Aceita "0,1", "0.1" e "100". Vazio = sem peso. Devolve undefined se for inválido. */
function parseWeight(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (/^\d+\.\d+$/.test(trimmed)) return Number(trimmed);
  return parseBrNumber(trimmed) ?? undefined;
}

function toDraft(item: ErpProductCatalogItem): Draft {
  return {
    display_name: item.display_name,
    sector: item.sector ?? "",
    group_name: item.group_name ?? "",
    unit_measure: item.unit_measure === "KG" || item.unit_measure === "UNID" ? item.unit_measure : "",
    weight: weightText(item.unit_weight_kg),
    active: item.active,
  };
}

type Built = { input: CatalogInput; error?: undefined } | { error: string; input?: undefined };

function toInput(code: string, draft: Draft): Built {
  const weight = parseWeight(draft.weight);
  if (weight === undefined) return { error: "Peso inválido." };
  return {
    input: {
      product_code: code,
      display_name: draft.display_name,
      sector: draft.sector || null,
      group_name: draft.group_name || null,
      unit_measure: draft.unit_measure || null,
      unit_weight_kg: weight,
      active: draft.active,
    },
  };
}

function CatalogRow({ item }: { item: ErpProductCatalogItem }) {
  const router = useRouter();
  const original = useMemo(() => toDraft(item), [item]);
  const [draft, setDraft] = useState<Draft>(original);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);

  function save() {
    const built = toInput(item.product_code, draft);
    if (built.error !== undefined) {
      setMessage({ ok: false, text: built.error });
      return;
    }
    startSaving(async () => {
      const result = await saveCatalogItem(built.input);
      setMessage(result.ok ? { ok: true, text: "Salvo" } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  return (
    <tr className={draft.active ? "" : "bg-neutral-50 text-neutral-500"}>
      <td className="whitespace-nowrap px-2 py-1.5 font-mono text-xs">{item.product_code}</td>
      <td className="px-2 py-1.5">
        <input className={field} value={draft.display_name} onChange={(e) => setDraft({ ...draft, display_name: e.target.value })} />
      </td>
      <td className="px-2 py-1.5">
        <select className={field} value={draft.sector} onChange={(e) => setDraft({ ...draft, sector: e.target.value as ErpSector | "" })}>
          <option value="">—</option>
          {SECTORS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1.5">
        <input className={field} value={draft.group_name} onChange={(e) => setDraft({ ...draft, group_name: e.target.value })} />
      </td>
      <td className="px-2 py-1.5">
        <select className={field} value={draft.unit_measure} onChange={(e) => setDraft({ ...draft, unit_measure: e.target.value as Draft["unit_measure"] })}>
          <option value="">—</option>
          <option value="UNID">UNID</option>
          <option value="KG">KG</option>
        </select>
      </td>
      <td className="px-2 py-1.5">
        <input
          className={`${field} w-24 text-right`}
          inputMode="decimal"
          value={draft.weight}
          onChange={(e) => setDraft({ ...draft, weight: e.target.value })}
          aria-label={`Peso por unidade (kg) de ${item.product_code}`}
        />
      </td>
      <td className="px-2 py-1.5 text-center">
        <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} aria-label="Ativo" />
      </td>
      <td className="whitespace-nowrap px-2 py-1.5">
        <Button type="button" variant="secondary" className="px-3 py-1 text-xs" disabled={!dirty || saving} onClick={save}>
          {saving ? "Salvando…" : "Salvar"}
        </Button>
        {message && <span className={`ml-2 text-xs ${message.ok ? "text-green-700" : "text-red-700"}`}>{message.text}</span>}
      </td>
    </tr>
  );
}

export function CatalogEditor({ initialItems, pending }: { initialItems: ErpProductCatalogItem[]; pending: PendingProduct[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [pendingDrafts, setPendingDrafts] = useState<Record<string, { name: string; weight: string; sector: ErpSector | "" }>>(() =>
    Object.fromEntries(pending.map((p) => [p.code, { name: p.description, weight: weightText(p.suggestedWeightKg), sector: "" as const }]))
  );
  const [pendingMessage, setPendingMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [registering, startRegistering] = useTransition();

  const [newCode, setNewCode] = useState("");
  const [newDraft, setNewDraft] = useState<Draft>({ display_name: "", sector: "", group_name: "", unit_measure: "UNID", weight: "", active: true });
  const [newMessage, setNewMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [creating, startCreating] = useTransition();

  const term = search.trim().toLowerCase();
  const visible = term
    ? initialItems.filter((i) => i.product_code.toLowerCase().includes(term) || i.display_name.toLowerCase().includes(term))
    : initialItems;

  const pendingWithoutWeight = pending.filter((p) => parseWeight(pendingDrafts[p.code]?.weight ?? "") == null).length;

  function registerPending() {
    const inputs: CatalogInput[] = [];
    for (const p of pending) {
      const draft = pendingDrafts[p.code];
      const weight = parseWeight(draft.weight);
      if (weight === undefined) {
        setPendingMessage({ ok: false, text: `Peso inválido no código ${p.code}.` });
        return;
      }
      inputs.push({
        product_code: p.code,
        display_name: draft.name,
        sector: draft.sector || null,
        group_name: null,
        unit_measure: p.unitMeasure,
        unit_weight_kg: weight,
        active: true,
      });
    }
    startRegistering(async () => {
      const result = await registerPendingItems(inputs);
      setPendingMessage(result.ok ? { ok: true, text: `${result.created ?? 0} itens cadastrados.` } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  function createItem() {
    const built = toInput(newCode.trim(), newDraft);
    if (built.error !== undefined) {
      setNewMessage({ ok: false, text: built.error });
      return;
    }
    startCreating(async () => {
      const result = await saveCatalogItem(built.input);
      setNewMessage(result.ok ? { ok: true, text: "Cadastrado." } : { ok: false, text: result.error });
      if (result.ok) {
        setNewCode("");
        setNewDraft({ ...newDraft, display_name: "", group_name: "", weight: "" });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Pendentes de cadastro ({pending.length})</h2>
            <p className="text-xs text-neutral-600">
              Códigos que apareceram nas importações e não estão no catálogo. O peso vem sugerido da descrição (&quot;100G&quot; = 0,100 kg); itens em KG ficam com peso 1.
              Confira, escolha o setor e cadastre.
            </p>
          </div>
          <div className="max-h-96 overflow-auto rounded-md bg-white">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-2 py-2">Código</th>
                  <th className="px-2 py-2">Nome</th>
                  <th className="px-2 py-2">UM</th>
                  <th className="px-2 py-2">Peso (kg)</th>
                  <th className="px-2 py-2">Setor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {pending.map((p) => {
                  const draft = pendingDrafts[p.code];
                  const set = (patch: Partial<typeof draft>) => setPendingDrafts((prev) => ({ ...prev, [p.code]: { ...draft, ...patch } }));
                  return (
                    <tr key={p.code}>
                      <td className="whitespace-nowrap px-2 py-1.5 font-mono text-xs">{p.code}</td>
                      <td className="px-2 py-1.5">
                        <input className={field} value={draft.name} onChange={(e) => set({ name: e.target.value })} />
                      </td>
                      <td className="px-2 py-1.5 text-xs">{p.unitMeasure}</td>
                      <td className="px-2 py-1.5">
                        <input className={`${field} w-24 text-right`} inputMode="decimal" value={draft.weight} onChange={(e) => set({ weight: e.target.value })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <select className={field} value={draft.sector} onChange={(e) => set({ sector: e.target.value as ErpSector | "" })}>
                          <option value="">—</option>
                          {SECTORS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={registerPending} disabled={registering}>
              {registering ? "Cadastrando…" : `Cadastrar pendentes (${pending.length})`}
            </Button>
            {pendingWithoutWeight > 0 && (
              <span className="text-xs text-amber-800">{pendingWithoutWeight} sem peso (sem gramagem na descrição) — ficam fora da conversão para kg até você informar.</span>
            )}
            {pendingMessage && <span className={`text-sm ${pendingMessage.ok ? "text-green-700" : "text-red-700"}`}>{pendingMessage.text}</span>}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">Catálogo ({initialItems.length})</h2>
          <input
            className={`${field} max-w-xs`}
            placeholder="Buscar por código ou nome"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {initialItems.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhum item cadastrado ainda. Importe um relatório e use os pendentes acima.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-2 py-2">Código</th>
                  <th className="px-2 py-2">Nome</th>
                  <th className="px-2 py-2">Setor</th>
                  <th className="px-2 py-2">Grupo</th>
                  <th className="px-2 py-2">UM</th>
                  <th className="px-2 py-2">Peso (kg)</th>
                  <th className="px-2 py-2 text-center">Ativo</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {visible.map((item) => (
                  <CatalogRow key={`${item.product_code}:${item.updated_at}`} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <details className="rounded-lg border border-neutral-200 bg-white">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-neutral-700">Cadastrar um código manualmente</summary>
        <div className="grid gap-3 border-t border-neutral-100 p-4 sm:grid-cols-3">
          <input className={field} placeholder="Código (ex.: 9000001)" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
          <input className={`${field} sm:col-span-2`} placeholder="Nome" value={newDraft.display_name} onChange={(e) => setNewDraft({ ...newDraft, display_name: e.target.value })} />
          <select className={field} value={newDraft.sector} onChange={(e) => setNewDraft({ ...newDraft, sector: e.target.value as ErpSector | "" })}>
            <option value="">Setor —</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input className={field} placeholder="Grupo" value={newDraft.group_name} onChange={(e) => setNewDraft({ ...newDraft, group_name: e.target.value })} />
          <select className={field} value={newDraft.unit_measure} onChange={(e) => setNewDraft({ ...newDraft, unit_measure: e.target.value as Draft["unit_measure"] })}>
            <option value="UNID">UNID</option>
            <option value="KG">KG</option>
          </select>
          <input className={field} placeholder="Peso por unidade (kg)" inputMode="decimal" value={newDraft.weight} onChange={(e) => setNewDraft({ ...newDraft, weight: e.target.value })} />
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="button" onClick={createItem} disabled={creating || !newCode.trim() || !newDraft.display_name.trim()}>
              {creating ? "Salvando…" : "Cadastrar"}
            </Button>
            {newMessage && <span className={`text-sm ${newMessage.ok ? "text-green-700" : "text-red-700"}`}>{newMessage.text}</span>}
          </div>
        </div>
      </details>
    </div>
  );
}
