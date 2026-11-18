"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";

export function StorePicker({
  date,
  options,
  basePath = "/pedidos",
}: {
  date: string;
  options: { value: string; label: string }[];
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("loja") ?? "";

  return (
    <Select
      value={current}
      onChange={(e) => {
        const value = e.target.value;
        const params = new URLSearchParams({ date });
        if (value) params.set("loja", value);
        router.push(`${basePath}/dia/imprimir-romaneio?${params.toString()}`);
      }}
      className="w-56"
    >
      <option value="">Todas as lojas</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
