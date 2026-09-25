"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import type { Store } from "@/lib/types/database.types";

export function StoreFilter({ stores, value }: { stores: Store[]; value: string }) {
  const router = useRouter();

  return (
    <Select
      value={value}
      onChange={(e) => {
        const storeId = e.target.value;
        router.push(storeId ? `/pedidos/respostas?store=${storeId}` : "/pedidos/respostas");
      }}
    >
      <option value="">Todas as lojas</option>
      {stores.map((store) => (
        <option key={store.id} value={store.id}>
          {store.name}
        </option>
      ))}
    </Select>
  );
}
