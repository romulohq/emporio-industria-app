"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createSubproduct, deleteSubproduct, renameSubproduct } from "@/app/(app)/produtos/fichas/actions";

const field =
  "rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-base focus:border-orange-600 focus:outline-none focus:ring-1 focus:ring-orange-600 sm:text-sm";

/** Creates a subproduct and goes straight to its technical sheet. */
export function SubproductCreate({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("kg");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canEdit) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createSubproduct({ name, unit });
      if (result.error || !result.id) {
        setError(result.error ?? "Não foi possível criar.");
        return;
      }
      router.push(`/produtos/subprodutos/${result.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold text-neutral-900">Novo subproduto</h2>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Cebola caramelizada"
          aria-label="Nome do subproduto"
          className={`${field} min-w-56 flex-1`}
        />
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          list="sp-units"
          aria-label="Unidade"
          className={`${field} w-24`}
        />
        <datalist id="sp-units">
          {["kg", "g", "L", "mL", "und", "pct"].map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <button
          type="submit"
          disabled={pending || name.trim().length < 2}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Criar e montar ficha
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}

/** Name and unit of a subproduct, plus deleting it while no recipe uses it. */
export function SubproductHeader({
  id,
  initialName,
  initialUnit,
  canEdit,
}: {
  id: string;
  initialName: string;
  initialUnit: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [unit, setUnit] = useState(initialUnit);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const changed = name.trim() !== initialName || unit.trim() !== initialUnit;

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await renameSubproduct({ id, name, unit });
      setMessage(result.error ? { ok: false, text: result.error } : { ok: true, text: "Dados do subproduto salvos." });
      if (!result.error) router.refresh();
    });
  }

  function remove() {
    if (!window.confirm("Excluir este subproduto e a ficha dele? Isso não pode ser desfeito.")) return;
    setMessage(null);
    startTransition(async () => {
      const result = await deleteSubproduct(id);
      if (result.error) setMessage({ ok: false, text: result.error });
      else router.push("/produtos/subprodutos");
    });
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Nome do subproduto"
          disabled={!canEdit}
          className={`${field} min-w-56 flex-1 font-medium disabled:bg-neutral-50`}
        />
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          aria-label="Unidade do subproduto"
          disabled={!canEdit}
          className={`${field} w-24 disabled:bg-neutral-50`}
        />
        {canEdit && (
          <>
            <button
              type="button"
              onClick={save}
              disabled={pending || !changed || name.trim().length < 2}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              Salvar nome
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="text-sm text-neutral-500 underline hover:text-red-600"
            >
              Excluir
            </button>
          </>
        )}
      </div>
      {message && <p className={`mt-2 text-sm ${message.ok ? "text-green-700" : "text-red-600"}`}>{message.text}</p>}
    </section>
  );
}
