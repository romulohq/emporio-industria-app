"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StockReportActions } from "@/components/public/stock-report-actions";
import type { SubmitState } from "@/app/relatar-estoque/[token]/actions";

const initialState: SubmitState = undefined;

export type ReportProduct = { id: string; name: string; unit: string };

export function StockReportForm({
  groups,
  action,
}: {
  groups: { sectorName: string; products: ReportProduct[] }[];
  action: (state: SubmitState, formData: FormData) => Promise<SubmitState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  if (state?.success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <p className="text-lg font-semibold text-green-800">Estoque relatado com sucesso!</p>
        <p className="mt-1 text-sm text-green-700">Obrigado — pode fechar esta página.</p>
        {state.report && <StockReportActions report={state.report} />}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      {groups.map((group) => (
        <div key={group.sectorName} className="rounded-lg border border-neutral-200 bg-white">
          <div className="border-b border-neutral-100 px-4 py-3 font-semibold text-neutral-900">
            {group.sectorName}
          </div>
          <div className="divide-y divide-neutral-100">
            {group.products.map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="text-sm text-neutral-800">{product.name}</span>
                <Input
                  type="number"
                  step="0.001"
                  min={0}
                  name={`qty_${product.id}`}
                  placeholder={`Qtd. (${product.unit})`}
                  className="w-32"
                  enterKeyHint="next"
                  // after the keyboard slides up, bring the field to the middle so what is typed stays visible
                  onFocus={(e) => {
                    const field = e.currentTarget;
                    setTimeout(() => field.scrollIntoView({ block: "center", behavior: "smooth" }), 350);
                  }}
                  required
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Enviando..." : "Enviar relato de estoque"}
      </Button>
    </form>
  );
}
