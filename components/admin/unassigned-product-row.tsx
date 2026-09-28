"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { assignProductResponsible } from "@/app/(app)/admin/setores/actions";
import type { SectorResponsible } from "@/lib/types/database.types";

export function UnassignedProductRow({
  productId,
  productName,
  responsibles,
}: {
  productId: string;
  productName: string;
  responsibles: SectorResponsible[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const responsibleId = e.target.value;
    setValue(responsibleId);
    const formData = new FormData();
    formData.set("product_id", productId);
    formData.set("responsible_id", responsibleId);
    startTransition(async () => {
      await assignProductResponsible(formData);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
      <span className="text-neutral-700">{productName}</span>
      <Select value={value} onChange={handleChange} disabled={pending} className="w-44">
        <option value="">Sem responsável</option>
        {responsibles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.role_name} — {r.person_name}
          </option>
        ))}
      </Select>
    </div>
  );
}
