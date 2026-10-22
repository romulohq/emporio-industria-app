"use client";

import { useActionState } from "react";
import type { CountSubmitState } from "@/app/contar-hortifrut/[token]/actions";

export type CountMaterial = { id: string; name: string; unit: string; quantity: number | null };

/** Mobile form of the daily hortifruti count (open with the public link, no login). */
export function HortifrutiCountForm({
  materials,
  action,
}: {
  materials: CountMaterial[];
  action: (state: CountSubmitState, formData: FormData) => Promise<CountSubmitState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
        {materials.map((m) => (
          <label key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-base text-neutral-900">{m.name}</span>
            <span className="flex items-center gap-2">
              <input
                name={`qty_${m.id}`}
                inputMode="decimal"
                defaultValue={m.quantity === null ? "" : String(m.quantity).replace(".", ",")}
                placeholder="0"
                aria-label={`Quantidade de ${m.name}`}
                className="w-24 rounded-lg border border-neutral-300 px-3 py-2 text-right text-base tabular-nums focus:border-orange-500 focus:outline-none"
              />
              <span className="w-8 text-sm text-neutral-500">{m.unit}</span>
            </span>
          </label>
        ))}
        {materials.length === 0 && <p className="px-4 py-6 text-sm text-neutral-500">Nenhum item cadastrado.</p>}
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Contagem enviada ({state.saved} {state.saved === 1 ? "item" : "itens"}). Obrigado!
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur">
        <button
          type="submit"
          disabled={pending}
          className="mx-auto block w-full max-w-md rounded-xl bg-orange-600 px-4 py-3 text-base font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {pending ? "Enviando..." : "Enviar contagem"}
        </button>
      </div>
    </form>
  );
}
