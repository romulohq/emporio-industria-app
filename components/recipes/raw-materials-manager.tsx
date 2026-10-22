"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createRawMaterial, deleteRawMaterial, updateRawMaterial } from "@/app/(app)/produtos/materias-primas/actions";
import { FilterBar, FilterSelect, SearchField, normalize } from "@/components/ui/filter-bar";

export type RawMaterialRow = {
  id: string;
  name: string;
  unit: string;
  code: string | null;
  category: "geral" | "hortifruti";
  uses: number;
};

const CATEGORIES = [
  { value: "geral", label: "Geral" },
  { value: "hortifruti", label: "Hortifrut" },
] as const;

const UNITS = ["kg", "g", "L", "mL", "und", "pct", "cx"];
const USE = [
  { value: "used", label: "Em uso nas fichas" },
  { value: "unused", label: "Sem uso" },
];

const field =
  "rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-base focus:border-orange-600 focus:outline-none focus:ring-1 focus:ring-orange-600 sm:text-sm";

/** Register, search, edit and delete the raw materials used by technical sheets and subproducts. */
export function RawMaterialsManager({ items, canEdit }: { items: RawMaterialRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [use, setUse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // new raw material
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("kg");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState<"geral" | "hortifruti">("geral");
  const [categoryFilter, setCategoryFilter] = useState("");

  // row being edited
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; unit: string; code: string; category: "geral" | "hortifruti" }>({
    name: "",
    unit: "",
    code: "",
    category: "geral",
  });

  const visible = useMemo(() => {
    const q = normalize(query);
    return items.filter((m) => {
      if (use === "used" && m.uses === 0) return false;
      if (use === "unused" && m.uses > 0) return false;
      if (categoryFilter && m.category !== categoryFilter) return false;
      return !q || normalize(`${m.name} ${m.code ?? ""}`).includes(q);
    });
  }, [items, query, use, categoryFilter]);

  function run(action: () => Promise<{ error?: string }>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      onDone?.();
      router.refresh();
    });
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    run(
      () => createRawMaterial({ name, unit, code, category }),
      () => {
        setName("");
        setCode("");
      }
    );
  }

  function startEdit(m: RawMaterialRow) {
    setError(null);
    setEditId(m.id);
    setDraft({ name: m.name, unit: m.unit, code: m.code ?? "", category: m.category });
  }

  function remove(m: RawMaterialRow) {
    if (!window.confirm(`Excluir a matéria-prima "${m.name}"?`)) return;
    run(() => deleteRawMaterial(m.id));
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <form onSubmit={create} className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-neutral-900">Nova matéria-prima</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Requeijão bisnaga"
              aria-label="Nome da matéria-prima"
              className={`${field} min-w-56 flex-1`}
            />
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              list="raw-units"
              aria-label="Unidade"
              className={`${field} w-24`}
            />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Código (opcional)"
              aria-label="Código"
              className={`${field} w-40`}
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as "geral" | "hortifruti")}
              aria-label="Categoria"
              className={`${field} w-36`}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pending || name.trim().length < 2 || unit.trim() === ""}
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Cadastrar
            </button>
          </div>
          <datalist id="raw-units">
            {UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma matéria-prima cadastrada ainda.</p>
      ) : (
        <>
          <FilterBar>
            <SearchField value={query} onChange={setQuery} placeholder="Buscar matéria-prima" />
            <FilterSelect value={use} onChange={setUse} label="Uso" options={USE} />
            <FilterSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              label="Categoria"
              options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
            />
            <span className="ml-auto text-xs text-neutral-500">
              {visible.length} {visible.length === 1 ? "matéria-prima" : "matérias-primas"}
            </span>
          </FilterBar>

          {visible.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhuma matéria-prima encontrada.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="px-4 py-2">Matéria-prima</th>
                    <th className="px-4 py-2">Unidade</th>
                    <th className="px-4 py-2">Código</th>
                    <th className="px-4 py-2">Categoria</th>
                    <th className="px-4 py-2">Uso</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((m) =>
                    editId === m.id ? (
                      <tr key={m.id} className="border-t border-neutral-100 bg-orange-50/40">
                        <td className="px-4 py-2">
                          <input
                            value={draft.name}
                            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                            aria-label="Nome"
                            className={`${field} w-full`}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            value={draft.unit}
                            onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
                            list="raw-units"
                            aria-label="Unidade"
                            className={`${field} w-24`}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            value={draft.code}
                            onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
                            aria-label="Código"
                            className={`${field} w-32`}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={draft.category}
                            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as "geral" | "hortifruti" }))}
                            aria-label="Categoria"
                            className={`${field} w-32`}
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2 text-neutral-500">{m.uses}</td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            disabled={pending || draft.name.trim().length < 2 || draft.unit.trim() === ""}
                            onClick={() =>
                              run(
                                () => updateRawMaterial({ id: m.id, ...draft }),
                                () => setEditId(null)
                              )
                            }
                            className="mr-3 text-sm font-semibold text-orange-700 hover:underline disabled:opacity-50"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditId(null)}
                            className="text-sm text-neutral-500 hover:underline"
                          >
                            Cancelar
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={m.id} className="border-t border-neutral-100">
                        <td className="px-4 py-2 font-medium text-neutral-900">{m.name}</td>
                        <td className="px-4 py-2 text-neutral-600">{m.unit}</td>
                        <td className="px-4 py-2 text-neutral-500">{m.code ?? "—"}</td>
                        <td className="px-4 py-2">
                          {m.category === "hortifruti" ? (
                            <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">Hortifrut</span>
                          ) : (
                            <span className="text-xs text-neutral-400">Geral</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {m.uses > 0 ? (
                            <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                              {m.uses} {m.uses === 1 ? "ficha" : "fichas"}
                            </span>
                          ) : (
                            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-500">
                              Sem uso
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(m)}
                                aria-label={`Editar ${m.name}`}
                                className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-orange-700"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => remove(m)}
                                aria-label={`Excluir ${m.name}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
