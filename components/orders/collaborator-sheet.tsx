import { formatQuantity } from "@/lib/format/labels";

export type CollaboratorSheetItem = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
};

export function CollaboratorSheet({
  sectorName,
  weekdayLabel,
  brDate,
  title,
  items,
  isFirst,
}: {
  sectorName: string;
  weekdayLabel: string;
  brDate: string;
  title: string;
  items: CollaboratorSheetItem[];
  isFirst: boolean;
}) {
  return (
    <section className={isFirst ? "collaborator-sheet" : "collaborator-sheet break-before-page"}>
      <table className="w-full border-collapse text-base">
        <thead>
          <tr>
            <th colSpan={3} className="border-b-2 border-orange-600 p-0 pb-3 text-left">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 text-xs font-extrabold text-white">
                  EP
                </span>
                <span className="text-sm font-extrabold text-neutral-900">
                  Empório do Pão — Ordem de Produção
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-600">
                {sectorName} · {weekdayLabel}, {brDate}
              </p>
              <p className="mt-2 text-xl font-black uppercase tracking-wide text-neutral-900">{title}</p>
            </th>
          </tr>
          <tr className="bg-orange-50">
            <th className="border border-orange-100 px-3 py-2 text-left font-semibold text-neutral-900">
              Produto
            </th>
            <th className="border border-orange-100 px-3 py-2 text-right font-semibold text-neutral-900">
              Quantidade
            </th>
            <th className="w-24 border border-orange-100 px-3 py-2 text-center font-semibold text-neutral-900">
              Feito ✓
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="even:bg-neutral-50">
              <td className="border border-neutral-200 px-3 py-2 font-medium text-neutral-900">{item.name}</td>
              <td className="border border-neutral-200 px-3 py-2 text-right font-bold text-neutral-900">
                {formatQuantity(item.quantity, item.unit)}
              </td>
              <td className="border border-neutral-200 px-3 py-2 text-center text-neutral-300">☐</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 text-sm text-neutral-600">
        <p>
          Total de itens: <span className="font-bold text-neutral-900">{items.length}</span>
        </p>
      </div>
      <div className="mt-8 flex items-end gap-2 text-sm text-neutral-600">
        <span>Assinatura/visto:</span>
        <span className="flex-1 border-b border-neutral-400" />
      </div>
    </section>
  );
}
