import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatDateTime } from "@/lib/format/labels";

export type ProductChange = {
  id: string;
  product_id: string;
  product_name: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by_name: string | null;
  changed_at: string;
};

/** Who changed a product's sector, responsible or status, from what to what, and when. */
export function ProductChangesList({
  changes,
  showProduct = false,
}: {
  changes: ProductChange[];
  /** show the product's name on each line (the general list) */
  showProduct?: boolean;
}) {
  if (changes.length === 0) {
    return <p className="text-sm text-neutral-500">Nenhuma alteração registrada ainda.</p>;
  }
  return (
    <ul className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 bg-white">
      {changes.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
          <span className="w-36 shrink-0 text-xs text-neutral-400">{formatDateTime(c.changed_at)}</span>
          {showProduct && (
            <Link href={`/produtos/${c.product_id}`} className="font-medium text-neutral-900 hover:underline">
              {c.product_name}
            </Link>
          )}
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            {c.field}
          </span>
          <span className="inline-flex items-center gap-1.5 text-neutral-700">
            <span className="text-neutral-500">{c.old_value ?? "—"}</span>
            <ArrowRight className="h-3.5 w-3.5 text-neutral-400" />
            <span className="font-medium">{c.new_value ?? "—"}</span>
          </span>
          <span className="ml-auto text-xs text-neutral-400">{c.changed_by_name ?? "pelo sistema"}</span>
        </li>
      ))}
    </ul>
  );
}
