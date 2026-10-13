import type { TreeNode } from "@/lib/recipes/tree";

const WEIGHT_AND_VOLUME = new Set(["kg", "g", "l", "ml"]);

/** Weight and volume with three decimals (18,000 kg); counts keep only the decimals they need. */
function fmtQuantity(n: number, unit: string) {
  const fixed = WEIGHT_AND_VOLUME.has(unit.trim().toLowerCase());
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: fixed ? 3 : 0,
    maximumFractionDigits: 3,
  }).format(n);
}

/** Total of the lines measured in kg or g, in kg; `partial` when other units were left out. */
function totalWeight(nodes: TreeNode[]): { kg: number; partial: boolean } | null {
  let kg = 0;
  let counted = 0;
  for (const node of nodes) {
    const unit = node.unit.trim().toLowerCase();
    if (unit === "kg") kg += node.quantity;
    else if (unit === "g") kg += node.quantity / 1000;
    else continue;
    counted += 1;
  }
  return counted === 0 ? null : { kg, partial: counted < nodes.length };
}

const countRows = (nodes: TreeNode[]): number => nodes.reduce((sum, n) => sum + 1 + countRows(n.children), 0);

// the sheet must stay on one A4 page: the more rows, the tighter the type and spacing
type Density = { cell: string; text: string; title: string; body: string; gap: string };
function densityFor(rows: number, hasMethod: boolean): Density {
  const load = rows + (hasMethod ? 5 : 0);
  if (load <= 14) return { cell: "py-2.5", text: "text-[13px]", title: "text-[32px]", body: "text-xs", gap: "mt-7" };
  if (load <= 24) return { cell: "py-1.5", text: "text-xs", title: "text-3xl", body: "text-[11px]", gap: "mt-5" };
  if (load <= 36) return { cell: "py-0.5", text: "text-[10.5px]", title: "text-2xl", body: "text-[10px]", gap: "mt-3.5" };
  return { cell: "py-px", text: "text-[9px]", title: "text-xl", body: "text-[9px]", gap: "mt-2.5" };
}

/**
 * The technical sheet as printed (shown only when printing): a quiet one-page layout with the product
 * name, the key figures, hairline-ruled ingredients and the total weight in a slim dark bar.
 * Quantities are already scaled; subproducts open into their own recipe under their line.
 */
export function RecipePrintSheet({
  title,
  code,
  unitLabel,
  kind,
  scaleText,
  yieldText,
  nodes,
  instructions,
  printedAt,
}: {
  title: string;
  code: string | null;
  unitLabel: string;
  /** e.g. the sector, or "Produto intermediário" for a subproduct */
  kind: string;
  /** e.g. "10 kg de rendimento · fator 8,333×"; null for the base recipe */
  scaleText: string | null;
  yieldText: string | null;
  nodes: TreeNode[];
  instructions: string;
  printedAt: string;
}) {
  const total = totalWeight(nodes);
  const hasMethod = instructions.trim() !== "";
  const d = densityFor(countRows(nodes), hasMethod);
  const meta = [
    code ? `Código ${code}` : null,
    unitLabel ? `Unidade ${unitLabel.toUpperCase()}` : null,
    kind,
    scaleText ? `Escalado para ${scaleText}` : "Receita base",
  ].filter(Boolean);

  return (
    <div className="hidden px-1 print:block">
      <style>{"@media print { @page { size: A4 portrait; margin: 12mm; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }"}</style>

      <div className="flex items-end justify-between gap-8 border-b border-neutral-300 pb-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-400">Ficha técnica</p>
          <h1 className={`mt-1 font-black leading-tight tracking-tight text-neutral-900 ${d.title}`}>{title}</h1>
          <p className="mt-1.5 text-[10.5px] text-neutral-500">{meta.join("  ·  ")}</p>
        </div>
        <div className="flex shrink-0 gap-7 text-right">
          {yieldText && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-neutral-400">Rendimento</p>
              <p className="mt-0.5 text-base font-extrabold uppercase tabular-nums text-neutral-900">{yieldText}</p>
            </div>
          )}
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-neutral-400">Itens</p>
            <p className="mt-0.5 text-base font-extrabold tabular-nums text-neutral-900">{nodes.length}</p>
          </div>
        </div>
      </div>

      <h2 className={`text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-400 ${d.gap}`}>Insumos</h2>
      <table className={`mt-2 w-full border-collapse ${d.text}`}>
        <thead>
          <tr className="border-b border-neutral-900 text-left text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
            <th className="py-1.5 pr-3 font-semibold">Ingrediente</th>
            <th className="px-3 py-1.5 text-right font-semibold">Quantidade</th>
            <th className="w-14 py-1.5 pl-3 font-semibold">Un.</th>
          </tr>
        </thead>
        <tbody>
          {nodes.length === 0 && (
            <tr>
              <td colSpan={3} className="py-3 text-neutral-500">
                Sem ingredientes.
              </td>
            </tr>
          )}
          {nodes.map((node, index) => (
            <Row key={`${node.label}-${index}`} node={node} depth={0} cell={d.cell} />
          ))}
        </tbody>
      </table>

      {total && (
        <div className={`flex items-center justify-between rounded-xl bg-neutral-900 px-5 py-2.5 text-white ${d.gap}`}>
          <div>
            <p className="text-xs font-medium tracking-wide">Peso total da receita</p>
            {total.partial && <p className="text-[9px] text-neutral-400">Soma dos insumos medidos em kg e g.</p>}
          </div>
          <p className="text-lg font-extrabold tabular-nums tracking-tight">{fmtQuantity(total.kg, "kg")} KG</p>
        </div>
      )}

      {hasMethod && (
        <section className={d.gap}>
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-400">Modo de preparo</h2>
          <p className={`mt-1.5 whitespace-pre-line leading-relaxed text-neutral-700 ${d.body}`}>{instructions}</p>
        </section>
      )}

      <p className="mt-4 text-right text-[9px] text-neutral-400">Impresso em {printedAt}</p>
    </div>
  );
}

function Row({ node, depth, cell }: { node: TreeNode; depth: number; cell: string }) {
  const isSp = node.subproductId !== null;
  return (
    <>
      <tr className="break-inside-avoid border-b border-neutral-200">
        <td className={`pr-3 ${cell}`} style={{ paddingLeft: `${depth * 1.25}rem` }}>
          <span className={isSp ? "font-bold text-neutral-900" : depth > 0 ? "text-neutral-500" : "font-medium text-neutral-900"}>
            {node.label}
          </span>
          {isSp && (
            <span className="ml-2 text-[8px] font-bold uppercase tracking-[0.16em] text-neutral-400">SP</span>
          )}
          {node.noRecipe && <span className="ml-2 text-[9px] text-neutral-400">(sem ficha cadastrada)</span>}
        </td>
        <td
          className={`whitespace-nowrap px-3 text-right font-bold tabular-nums ${cell} ${depth > 0 ? "text-neutral-500" : "text-neutral-900"}`}
        >
          {fmtQuantity(node.quantity, node.unit)}
        </td>
        <td className={`pl-3 text-[0.8em] font-semibold uppercase text-neutral-400 ${cell}`}>{node.unit}</td>
      </tr>
      {node.children.map((child, i) => (
        <Row key={`${child.label}-${i}`} node={child} depth={depth + 1} cell={cell} />
      ))}
    </>
  );
}
