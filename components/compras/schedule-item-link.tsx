"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkScheduleItem } from "@/app/(app)/compras/hortifrut/actions";

/** Picks the technical sheet a production-schedule item reads its ingredients from. */
export function ScheduleItemLink({
  scheduleItemId,
  options,
}: {
  scheduleItemId: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await linkScheduleItem(scheduleItemId, value);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Ficha técnica deste item"
        className="min-w-56 rounded-md border border-neutral-300 bg-white px-2 py-1 text-base sm:text-sm"
      >
        <option value="">Escolha a ficha técnica</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={save}
        disabled={pending || value === ""}
        className="rounded-lg bg-orange-600 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
      >
        {pending ? "Vinculando..." : "Vincular"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
