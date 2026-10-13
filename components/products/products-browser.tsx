"use client";

import { useMemo, useState } from "react";
import { ProductTable } from "@/components/products/product-table";
import { FilterBar, FilterSelect, SearchField, normalize } from "@/components/ui/filter-bar";
import type { Product, Sector } from "@/lib/types/database.types";

const STATUS = [
  { value: "low", label: "Estoque baixo" },
  { value: "ok", label: "Estoque OK" },
  { value: "inactive", label: "Inativos" },
];

/** The product list with a search box and filters by sector and by situation. */
export function ProductsBrowser({ products, sectors }: { products: Product[]; sectors: Sector[] }) {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [status, setStatus] = useState("");

  const sectorsById = useMemo(() => Object.fromEntries(sectors.map((s) => [s.id, s])), [sectors]);
  const sectorOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) counts.set(p.sector_id, (counts.get(p.sector_id) ?? 0) + 1);
    return sectors
      .filter((s) => counts.has(s.id))
      .map((s) => ({ value: s.id, label: `${s.name} (${counts.get(s.id)})` }));
  }, [products, sectors]);

  const visible = useMemo(() => {
    const q = normalize(query);
    return products.filter((p) => {
      if (sector && p.sector_id !== sector) return false;
      if (status === "low" && !p.is_low_stock) return false;
      if (status === "ok" && (p.is_low_stock || !p.active)) return false;
      if (status === "inactive" && p.active) return false;
      if (q && !normalize(`${p.name} ${p.sku ?? ""}`).includes(q)) return false;
      return true;
    });
  }, [products, query, sector, status]);

  return (
    <div className="space-y-4">
      <FilterBar>
        <SearchField value={query} onChange={setQuery} placeholder="Buscar produto" />
        <FilterSelect value={sector} onChange={setSector} label="Setor" options={sectorOptions} />
        <FilterSelect value={status} onChange={setStatus} label="Situação" options={STATUS} />
        <span className="ml-auto text-xs text-neutral-500">
          {visible.length} {visible.length === 1 ? "produto" : "produtos"}
        </span>
      </FilterBar>

      {visible.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum produto encontrado.</p>
      ) : (
        <ProductTable products={visible} sectorsById={sectorsById} />
      )}
    </div>
  );
}
