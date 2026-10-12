import Link from "next/link";
import { Layers } from "lucide-react";
import type { TreeNode } from "@/lib/recipes/tree";

const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n);

/** The recipe as a tree: subproducts open into their own recipes, as deep as they go. */
export function RecipeTree({
  title,
  yieldText,
  nodes,
}: {
  title: string;
  yieldText: string | null;
  nodes: TreeNode[];
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-neutral-100 pb-2">
        <p className="text-sm font-semibold text-neutral-900">{title}</p>
        {yieldText && <p className="text-xs text-neutral-500">Rende {yieldText}</p>}
      </div>
      {nodes.length === 0 ? (
        <p className="text-sm text-neutral-500">Ainda não há ingredientes nesta ficha.</p>
      ) : (
        <Nodes nodes={nodes} />
      )}
    </div>
  );
}

function Nodes({ nodes }: { nodes: TreeNode[] }) {
  return (
    <ul className="space-y-1">
      {nodes.map((node, index) => (
        <li key={`${node.label}-${index}`}>
          <NodeRow node={node} />
        </li>
      ))}
    </ul>
  );
}

function NodeRow({ node }: { node: TreeNode }) {
  const amount = (
    <span className="ml-auto shrink-0 tabular-nums text-neutral-700">
      {fmt(node.quantity)} {node.unit}
    </span>
  );

  if (!node.subproductId) {
    return (
      <div className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-neutral-800">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300" />
        {node.label}
        {amount}
      </div>
    );
  }

  return (
    <details open className="group rounded-md border border-orange-100 bg-orange-50/40">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-neutral-900 marker:hidden">
        <Layers className="h-3.5 w-3.5 shrink-0 text-orange-600" />
        <Link href={`/produtos/subprodutos/${node.subproductId}`} className="hover:underline">
          {node.label}
        </Link>
        <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-orange-700">SP</span>
        {amount}
      </summary>
      <div className="border-t border-orange-100 px-2 py-1.5 pl-5">
        {node.cycle ? (
          <p className="text-xs text-red-600">Este subproduto aparece dentro dele mesmo.</p>
        ) : node.noRecipe ? (
          <p className="text-xs text-neutral-500">Este subproduto ainda não tem ficha técnica.</p>
        ) : (
          <>
            {node.unscaled && (
              <p className="mb-1 text-[11px] text-neutral-400">
                Quantidades da receita base (a unidade usada é diferente do rendimento).
              </p>
            )}
            <Nodes nodes={node.children} />
          </>
        )}
      </div>
    </details>
  );
}
