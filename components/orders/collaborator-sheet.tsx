import { formatQuantity } from "@/lib/format/labels";

export type CollaboratorSheetItem = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  /** optional category; when set, items are listed under a heading per category, in the order given */
  group?: string;
};

type Row = { kind: "heading"; label: string } | { kind: "item"; item: CollaboratorSheetItem };

// An A4 portrait sheet holds ~24 comfortable rows or ~36 dense ones in a single column; beyond that
// the list is split into two side-by-side columns so one store/person always fits on one sheet.
const COMFORTABLE_MAX = 24;
const SINGLE_COLUMN_MAX = 36;

function buildRows(items: CollaboratorSheetItem[]): Row[] {
  if (!items.some((i) => i.group)) return items.map((item) => ({ kind: "item", item }));
  const rows: Row[] = [];
  let current: string | undefined;
  for (const item of items) {
    if (item.group && item.group !== current) {
      rows.push({ kind: "heading", label: item.group });
      current = item.group;
    }
    rows.push({ kind: "item", item });
  }
  return rows;
}

/** Splits rows into balanced columns without leaving a category heading alone at the bottom of one. */
function splitRows(rows: Row[], columns: number): Row[][] {
  if (columns === 1) return [rows];
  const size = Math.ceil(rows.length / columns);
  const chunks: Row[][] = [];
  let start = 0;
  for (let c = 0; c < columns; c++) {
    let end = c === columns - 1 ? rows.length : Math.min(rows.length, start + size);
    if (end < rows.length && rows[end - 1]?.kind === "heading") end -= 1;
    chunks.push(rows.slice(start, end));
    start = end;
  }
  return chunks;
}

export function CollaboratorSheet({
  subtitle,
  title,
  items,
  isFirst,
  checkColumnLabel = "Feito ✓",
}: {
  subtitle: string;
  title: string;
  items: CollaboratorSheetItem[];
  isFirst: boolean;
  checkColumnLabel?: string;
}) {
  const rows = buildRows(items);
  const dense = rows.length > COMFORTABLE_MAX;
  const columns = rows.length > SINGLE_COLUMN_MAX ? 2 : 1;
  const chunks = splitRows(rows, columns);

  const cell = dense ? "px-2 py-0.5 text-[11px] leading-tight" : "px-3 py-2 print:py-1.5";
  const headCell = dense ? "px-2 py-1 text-[11px]" : "px-3 py-2 print:py-1.5";

  return (
    <section className={isFirst ? "collaborator-sheet" : "collaborator-sheet break-before-page"}>
      <div className="border-b-2 border-orange-600 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 text-xs font-extrabold text-white">
            EP
          </span>
          <span className="text-sm font-extrabold text-neutral-900">Empório do Pão — Ordem de Produção</span>
        </div>
        <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>
        <p className="mt-2 text-xl font-black uppercase tracking-wide text-neutral-900">{title}</p>
      </div>

      <div className={columns === 2 ? "mt-3 grid grid-cols-2 gap-4" : "mt-3"}>
        {chunks.map((chunk, index) => (
          <table key={index} className="w-full self-start border-collapse text-sm">
            <thead>
              <tr className="bg-orange-50">
                <th className={`border border-orange-100 text-left font-semibold text-neutral-900 ${headCell}`}>
                  Produto
                </th>
                <th className={`border border-orange-100 text-right font-semibold text-neutral-900 ${headCell}`}>
                  Qtd.
                </th>
                <th
                  className={`border border-orange-100 text-center font-semibold text-neutral-900 ${headCell} ${
                    columns === 2 ? "w-14" : "w-24"
                  }`}
                >
                  {checkColumnLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {chunk.map((row, rowIndex) =>
                row.kind === "heading" ? (
                  <tr key={`h-${rowIndex}`} className="break-inside-avoid">
                    <td
                      colSpan={3}
                      className="border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600"
                    >
                      {row.label}
                    </td>
                  </tr>
                ) : (
                  <tr key={row.item.id} className="break-inside-avoid">
                    <td className={`border border-neutral-200 font-medium text-neutral-900 ${cell}`}>
                      {row.item.name}
                    </td>
                    <td
                      className={`whitespace-nowrap border border-neutral-200 text-right font-bold text-neutral-900 ${cell}`}
                    >
                      {formatQuantity(row.item.quantity, row.item.unit)}
                    </td>
                    <td className={`border border-neutral-200 text-center text-neutral-300 ${cell}`}>☐</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        ))}
      </div>

      <div className="mt-3 text-sm text-neutral-600">
        <p>
          Total de itens: <span className="font-bold text-neutral-900">{items.length}</span>
        </p>
      </div>
      <div className="mt-6 flex items-end gap-2 text-sm text-neutral-600">
        <span>Assinatura/visto:</span>
        <span className="flex-1 border-b border-neutral-400" />
      </div>
    </section>
  );
}
