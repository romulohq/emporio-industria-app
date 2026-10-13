"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/produtos", label: "Produtos", exact: true },
  { href: "/produtos/subprodutos", label: "Subprodutos", exact: false },
  { href: "/produtos/fichas", label: "Fichas técnicas", exact: false },
];

export function ProdutosTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b border-neutral-200 print:hidden">
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              active
                ? "border-orange-600 text-orange-700"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
