"use client";

import { ChevronDown, Search } from "lucide-react";

/** Lower-cased, accent-free text, so "pao" finds "PÃO". */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const pill =
  "rounded-xl border border-neutral-200 bg-neutral-50 text-base text-neutral-800 transition-colors hover:border-neutral-300 focus:border-orange-500 focus:bg-white focus:outline-none sm:text-sm";

export function SearchField({
  value,
  onChange,
  placeholder = "Buscar",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="relative block w-full sm:w-64">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-neutral-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`${pill} w-full py-2 pl-10 pr-3 placeholder:text-neutral-400`}
      />
    </label>
  );
}

export function FilterSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  /** shown when nothing is selected, e.g. "Setor" */
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="relative block">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={`${pill} w-full cursor-pointer appearance-none py-2 pl-3 pr-9 ${value === "" ? "text-neutral-400" : ""}`}
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
    </label>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}
