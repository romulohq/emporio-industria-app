"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/compras/hortifrut", label: "Contagem de hortifrut" },
  { href: "/compras/hortifrut/demanda", label: "Demanda semanal" },
  { href: "/compras/hortifrut/solicitacao", label: "Solicitação" },
];

export function HortifrutTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-neutral-200 print:hidden">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "shrink-0 border-b-2 px-3 py-2 text-sm font-medium",
            pathname === tab.href
              ? "border-orange-600 text-orange-700"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
