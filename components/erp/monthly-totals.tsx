import { formatMonthBR, formatNumberBR } from "@/lib/erp/br";
import type { MonthTotals } from "@/lib/erp/monthly";

export function MonthlyTotals({ months }: { months: MonthTotals[] }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-neutral-900">Acumulado por mês</h2>
      {months.length === 0 ? (
        <p className="text-sm text-neutral-500">Nada importado ainda.</p>
      ) : (
        <div className="space-y-2">
          {months.map((m, index) => (
            <details key={m.month} open={index === 0} className="rounded-lg border border-neutral-200 bg-white">
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-6 gap-y-1 px-3 py-2.5 text-sm">
                <span className="min-w-28 font-semibold capitalize text-neutral-900">{formatMonthBR(m.month)}</span>
                <span className="text-neutral-600">{m.orders} ordens</span>
                <span className="font-medium text-neutral-900">{formatNumberBR(m.kg, 1)} kg</span>
                {m.units > 0 && <span className="text-neutral-600">{formatNumberBR(m.units, 0)} unidades</span>}
                {m.open > 0 && <span className="text-xs text-amber-700">{m.open} ainda não concluídas</span>}
                {m.withoutWeight > 0 && <span className="text-xs text-amber-700">{m.withoutWeight} sem peso cadastrado (fora do total em kg)</span>}
              </summary>
              <div className="overflow-x-auto border-t border-neutral-100">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="px-3 py-2">Produto</th>
                      <th className="px-3 py-2 text-right">Ordens</th>
                      <th className="px-3 py-2 text-right">Quantidade</th>
                      <th className="px-3 py-2 text-right">Kg</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {m.products.map((p) => (
                      <tr key={p.code}>
                        <td className="px-3 py-1.5">{p.name}</td>
                        <td className="px-3 py-1.5 text-right">{p.orders}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right">
                          {formatNumberBR(p.quantity, 3)} {p.unitMeasure === "KG" ? "kg" : "un"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right">{formatNumberBR(p.kg, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
