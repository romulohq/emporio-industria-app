"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FilterBar, FilterSelect, SearchField, normalize } from "@/components/ui/filter-bar";

export type FichaGroup = {
  sectorId: string;
  sectorName: string;
  products: { id: string; name: string; ingredients: number }[];
};

const STATUS = [
  { value: "with", label: "Com ficha" },
  { value: "without", label: "Sem ficha" },
];

/** Products grouped by sector, with a search box and filters by sector and by sheet status. */
export function FichasBrowser({ groups }: { groups: FichaGroup[] }) {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [status, setStatus] = useState("");

  const sectorOptions = groups.map((g) => ({ value: g.sectorId, label: `${g.sectorName} (${g.products.length})` }));

  const visible = useMemo(() => {
    const q = normalize(query);
    return groups
      .filter((g) => !sector || g.sectorId === sector)
      .map((g) => ({
        ...g,
        products: g.products.filter((p) => {
          if (status === "with" && p.ingredients === 0) return false;
          if (status === "without" && p.ingredients > 0) return false;
          return !q || normalize(p.name).includes(q);
        }),
      }))
      .filter((g) => g.products.length > 0);
  }, [groups, query, sector, status]);

  const total = visible.reduce((sum, g) => sum + g.products.length, 0);

  return (
    <div className="space-y-4">
      <FilterBar>
        <SearchField value={query} onChange={setQuery} placeholder="Buscar produto" />
        <FilterSelect value={sector} onChange={setSector} label="Setor" options={sectorOptions} />
        <FilterSelect value={status} onChange={setStatus} label="Ficha" options={STATUS} />
        <span className="ml-auto text-xs text-neutral-500">
          {total} {total === 1 ? "produto" : "produtos"}
        </span>
      </FilterBar>

      {visible.length === 0 && <p className="text-sm text-neutral-500">Nenhum produto encontrado.</p>}

      {visible.map((group) => (
        <section key={group.sectorId} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <h2 className="bg-neutral-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {group.sectorName}
          </h2>
          <ul>
            {group.products.map((product) => (
              <li key={product.id} className="border-t border-neutral-100">
                <Link
                  href={`/produtos/fichas/${product.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-neutral-50"
                >
                  <span className="font-medium text-neutral-900">{product.name}</span>
                  {product.ingredients > 0 ? (
                    <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      {product.ingredients} {product.ingredients === 1 ? "ingrediente" : "ingredientes"}
                    </span>
                  ) : (
                    <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-500">Sem ficha</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
