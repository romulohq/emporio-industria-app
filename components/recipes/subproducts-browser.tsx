"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Layers } from "lucide-react";
import { FilterBar, FilterSelect, SearchField, normalize } from "@/components/ui/filter-bar";

export type SubproductRow = { id: string; name: string; ingredients: number };

const STATUS = [
  { value: "with", label: "Com ficha" },
  { value: "without", label: "Sem ficha" },
];

/** The subproduct list with a search box and a filter by sheet status. */
export function SubproductsBrowser({ items }: { items: SubproductRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  const visible = useMemo(() => {
    const q = normalize(query);
    return items.filter((sp) => {
      if (status === "with" && sp.ingredients === 0) return false;
      if (status === "without" && sp.ingredients > 0) return false;
      return !q || normalize(sp.name).includes(q);
    });
  }, [items, query, status]);

  if (items.length === 0) return <p className="text-sm text-neutral-500">Nenhum subproduto cadastrado ainda.</p>;

  return (
    <div className="space-y-4">
      <FilterBar>
        <SearchField value={query} onChange={setQuery} placeholder="Buscar subproduto" />
        <FilterSelect value={status} onChange={setStatus} label="Ficha" options={STATUS} />
        <span className="ml-auto text-xs text-neutral-500">
          {visible.length} {visible.length === 1 ? "subproduto" : "subprodutos"}
        </span>
      </FilterBar>

      {visible.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum subproduto encontrado.</p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          {visible.map((sp, index) => (
            <li key={sp.id} className={index > 0 ? "border-t border-neutral-100" : ""}>
              <Link
                href={`/produtos/subprodutos/${sp.id}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-neutral-50"
              >
                <span className="flex items-center gap-2 font-medium text-neutral-900">
                  <Layers className="h-4 w-4 text-orange-600" />
                  {sp.name}
                  <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-orange-700">
                    SP
                  </span>
                </span>
                {sp.ingredients > 0 ? (
                  <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    {sp.ingredients} {sp.ingredients === 1 ? "ingrediente" : "ingredientes"}
                  </span>
                ) : (
                  <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-500">Sem ficha</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
