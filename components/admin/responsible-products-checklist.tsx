"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveResponsibleProducts } from "@/app/(app)/admin/setores/actions";

export type ChecklistProduct = {
  id: string;
  name: string;
  ownerId: string | null;
  ownerName: string | null;
  sectorId: string;
  sectorName: string;
};

export function ResponsibleProductsChecklist({
  sectorId,
  responsibleId,
  responsibleName,
  products,
}: {
  sectorId: string;
  responsibleId: string;
  responsibleName: string;
  products: ChecklistProduct[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [search, products]);
  const ownSector = filtered.filter((p) => p.sectorId === sectorId);
  const otherSectors = filtered.filter((p) => p.sectorId !== sectorId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const checkedIds = new Set(formData.getAll("product_ids").map(String));

    const transfers = products.filter(
      (p) => checkedIds.has(p.id) && p.ownerId && p.ownerId !== responsibleId
    );
    if (transfers.length > 0) {
      const names = transfers.map((p) => `${p.name} (com ${p.ownerName})`).join(", ");
      const confirmed = window.confirm(
        `Transferir para ${responsibleName}: ${names}? Esses produtos vão sair de quem é hoje.`
      );
      if (!confirmed) return;
    }

    const moves = products.filter((p) => checkedIds.has(p.id) && p.sectorId !== sectorId);
    if (moves.length > 0) {
      const names = moves.map((p) => `${p.name} (hoje em ${p.sectorName})`).join(", ");
      const confirmed = window.confirm(
        `Mover para este setor: ${names}?\n\nEles saem da ordem do setor atual e as ordens abertas deles passam para este setor.`
      );
      if (!confirmed) return;
    }

    setSaving(true);
    await saveResponsibleProducts(formData);
    setSaving(false);
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <input type="hidden" name="sector_id" value={sectorId} />
      <input type="hidden" name="responsible_id" value={responsibleId} />

      <Input
        placeholder="Buscar produto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs"
      />

      <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {ownSector.length === 0 && (
          <p className="px-3 py-4 text-sm text-neutral-500">Nenhum produto encontrado.</p>
        )}
        {ownSector.map((product) => (
          <ProductRow key={product.id} product={product} responsibleId={responsibleId} />
        ))}
      </div>

      {otherSectors.length > 0 && (
        <div className="space-y-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Produtos de outros setores
          </h2>
          <p className="text-xs text-neutral-500">Marcar um produto daqui o move para este setor, com esta pessoa.</p>
          <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
            {otherSectors.map((product) => (
              <ProductRow key={product.id} product={product} responsibleId={responsibleId} showSector />
            ))}
          </div>
        </div>
      )}

      <Button type="submit" disabled={saving}>
        {saving ? "Salvando..." : "Salvar produtos"}
      </Button>
    </form>
  );
}

function ProductRow({
  product,
  responsibleId,
  showSector = false,
}: {
  product: ChecklistProduct;
  responsibleId: string;
  showSector?: boolean;
}) {
  const ownedByOther = product.ownerId && product.ownerId !== responsibleId;
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-neutral-50">
      <span className="flex items-center gap-2">
        <input
          type="checkbox"
          name="product_ids"
          value={product.id}
          defaultChecked={product.ownerId === responsibleId}
          className="h-4 w-4 rounded border-neutral-300 text-orange-600 focus:ring-orange-600"
        />
        <span className="text-neutral-800">{product.name}</span>
      </span>
      <span className="flex items-center gap-2 text-xs text-neutral-400">
        {showSector && <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-500">{product.sectorName}</span>}
        {ownedByOther && <span>com {product.ownerName}</span>}
      </span>
    </label>
  );
}
