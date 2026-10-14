"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteStockSubmissions } from "@/app/(app)/pedidos/respostas/actions";
import { ResponseSessionRow, type ResponseItem } from "@/components/orders/response-session-row";

export type ResponseSession = {
  submissionId: string;
  storeName: string;
  createdAt: string;
  items: ResponseItem[];
};

/** The list of store submissions, with row selection and deleting one or many at once. */
export function ResponsesTable({ sessions }: { sessions: ResponseSession[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const allSelected = sessions.length > 0 && sessions.every((s) => selected.has(s.submissionId));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(sessions.map((s) => s.submissionId)));
  }

  function remove(ids: string[], label: string) {
    const question =
      ids.length === 1
        ? `Excluir o envio de ${label}? Isso apaga o registro de forma definitiva.`
        : `Excluir ${ids.length} envios selecionados? Isso apaga os registros de forma definitiva.`;
    if (!window.confirm(`${question}\n\nA quantidade que esse envio colocou nas ordens de produção de hoje em diante também é retirada. Ordens de datas passadas não mudam.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteStockSubmissions(ids);
      if (result.error) setError(result.error);
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm">
          <span className="font-medium text-orange-900">
            {selected.size} {selected.size === 1 ? "envio selecionado" : "envios selecionados"}
          </span>
          <button
            type="button"
            onClick={() => remove([...selected], "")}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {pending ? "Excluindo..." : "Excluir selecionados"}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs font-medium text-neutral-600 hover:underline"
          >
            Limpar seleção
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
            <tr>
              <th className="w-10 px-4 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={sessions.length === 0}
                  aria-label="Selecionar todos os envios"
                  className="h-4 w-4 cursor-pointer accent-orange-600"
                />
              </th>
              <th className="px-4 py-2">Data/hora</th>
              <th className="px-4 py-2">Loja</th>
              <th className="px-4 py-2">Itens</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <ResponseSessionRow
                key={session.submissionId}
                storeName={session.storeName}
                createdAt={session.createdAt}
                items={session.items}
                selected={selected.has(session.submissionId)}
                onToggleSelected={() => toggle(session.submissionId)}
                onDelete={() => remove([session.submissionId], `${session.storeName} (${session.createdAt})`)}
                busy={pending}
              />
            ))}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  Nenhuma resposta registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
