"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/estoque", label: "Contagem do dia" },
  { href: "/estoque/mes", label: "Visão do mês" },
  { href: "/estoque/saldo", label: "Saldo e movimentações" },
];

export function EstoqueTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b border-neutral-200 print:hidden">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "border-b-2 px-3 py-2 text-sm font-medium",
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
