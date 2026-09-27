"use client";

import { useRef } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={assignProductResponsible}
      className="flex items-center justify-between gap-2 py-1.5 text-sm"
    >
      <input type="hidden" name="product_id" value={productId} />
      <span className="text-neutral-700">{productName}</span>
      <Select
        name="responsible_id"
        defaultValue=""
        className="w-44"
        onChange={() => formRef.current?.requestSubmit()}
      >
        <option value="">Sem responsável</option>
        {responsibles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.role_name} — {r.person_name}
          </option>
        ))}
      </Select>
    </form>
  );
}
