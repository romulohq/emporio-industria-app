"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";

export function CollaboratorPicker({
  date,
  sectorId,
  options,
}: {
  date: string;
  sectorId: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("responsavel") ?? "";

  return (
    <Select
      value={current}
      onChange={(e) => {
        const value = e.target.value;
        const params = new URLSearchParams({ date, sector: sectorId });
        if (value) params.set("responsavel", value);
        router.push(`/pedidos/dia/imprimir-colaboradores?${params.toString()}`);
      }}
      className="w-56"
    >
      <option value="">Todas as folhas</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
