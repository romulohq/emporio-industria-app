import { EmporioLogo } from "@/components/brand/emporio-logo";
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

/**
 * The technical sheet as printed (shown only when printing): quiet Apple-like layout with the product
 * name, a few key figures, the ingredients in a rounded card and the total weight in a dark bar.
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
  /** e.g. "10 kg de rendimento (fator 8,333×)"; null for the base recipe */
  scaleText: string | null;
  yieldText: string | null;
  nodes: TreeNode[];
  instructions: string;
  printedAt: string;
}) {
  const total = totalWeight(nodes);
  const meta = [
    code ? `Código ${code}` : null,
    unitLabel ? `Unidade ${unitLabel.toUpperCase()}` : null,
    kind,
    scaleText ? `Escalado para ${scaleText}` : "Receita base",
  ].filter(Boolean);

  return (
    <div className="hidden px-2 pt-4 print:block">
      <style>{"@media print { @page { size: A4 portrait; margin: 14mm; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }"}</style>

      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Ficha técnica</p>
          <h1 className="mt-0.5 text-4xl font-black leading-tight tracking-tight text-neutral-900">{title}</h1>
          <p className="mt-1.5 text-[11px] font-semibold text-neutral-500">{meta.join("  ·  ")}</p>
        </div>
        <EmporioLogo className="h-20 w-20 shrink-0" />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {yieldText && (
          <div className="rounded-2xl bg-neutral-100 px-4 py-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-neutral-500">Rendimento</p>
            <p className="text-sm font-extrabold uppercase text-neutral-900">{yieldText}</p>
          </div>
        )}
        <div className="rounded-2xl bg-neutral-100 px-4 py-2 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-neutral-500">Itens</p>
          <p className="text-sm font-extrabold text-neutral-900">{nodes.length}</p>
        </div>
      </div>

      <h2 className="mt-6 text-2xl font-extrabold tracking-tight text-neutral-900">Insumos</h2>
      <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
        <table className="w-full border-collapse text-base">
          <thead>
            <tr className="bg-neutral-100 text-left text-[10px] font-bold uppercase tracking-wide text-neutral-500">
              <th className="px-5 py-2.5">Ingrediente</th>
              <th className="px-3 py-2.5 text-right">Quantidade</th>
              <th className="w-16 px-5 py-2.5">Un.</th>
            </tr>
          </thead>
          <tbody>
            {nodes.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-4 text-neutral-500">
                  Sem ingredientes.
                </td>
              </tr>
            )}
            {nodes.map((node, index) => (
              <Row key={`${node.label}-${index}`} node={node} depth={0} />
            ))}
          </tbody>
        </table>
      </div>

      {total && (
        <div className="mt-6 flex items-center justify-between rounded-2xl bg-neutral-900 px-5 py-3.5 text-white">
          <div>
            <p className="text-sm font-semibold">Peso total da receita</p>
            {total.partial && <p className="text-[10px] text-neutral-400">Soma dos insumos medidos em kg e g.</p>}
          </div>
          <p className="text-2xl font-extrabold tabular-nums">
            {fmtQuantity(total.kg, "kg")} KG
          </p>
        </div>
      )}

      {instructions.trim() !== "" && (
        <section className="mt-6 break-inside-avoid">
          <h2 className="text-2xl font-extrabold tracking-tight text-neutral-900">Modo de preparo</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-neutral-800">{instructions}</p>
        </section>
      )}

      <p className="mt-8 text-right text-[10px] text-neutral-400">Impresso em {printedAt}</p>
    </div>
  );
}

function Row({ node, depth }: { node: TreeNode; depth: number }) {
  const isSp = node.subproductId !== null;
  return (
    <>
      <tr className="break-inside-avoid border-t border-neutral-200">
        <td className="px-5 py-3" style={{ paddingLeft: `${1.25 + depth * 1.5}rem` }}>
          <span className={isSp ? "font-bold text-neutral-900" : depth > 0 ? "text-neutral-600" : "text-neutral-900"}>
            {node.label}
          </span>
          {isSp && (
            <span className="ml-2 rounded bg-orange-100 px-1.5 py-px text-[9px] font-bold uppercase text-orange-700">
              SP
            </span>
          )}
          {node.noRecipe && <span className="ml-2 text-[10px] text-neutral-400">(sem ficha cadastrada)</span>}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-neutral-900">
          {fmtQuantity(node.quantity, node.unit)}
        </td>
        <td className="px-5 py-3 text-xs font-semibold uppercase text-neutral-400">{node.unit}</td>
      </tr>
      {node.children.map((child, i) => (
        <Row key={`${child.label}-${i}`} node={child} depth={depth + 1} />
      ))}
    </>
  );
}
