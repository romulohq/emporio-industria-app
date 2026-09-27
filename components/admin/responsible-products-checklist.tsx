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
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-sm text-neutral-500">Nenhum produto encontrado.</p>
        )}
        {filtered.map((product) => {
          const ownedByOther = product.ownerId && product.ownerId !== responsibleId;
          return (
            <label
              key={product.id}
              className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-neutral-50"
            >
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
              {ownedByOther && (
                <span className="text-xs text-neutral-400">com {product.ownerName}</span>
              )}
            </label>
          );
        })}
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? "Salvando..." : "Salvar produtos"}
      </Button>
    </form>
  );
}
