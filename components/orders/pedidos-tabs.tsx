"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/pedidos", label: "Todos" },
  { href: "/pedidos/dia", label: "Por dia (Rui Barbosa)" },
  { href: "/pedidos/dia/historico", label: "Histórico de pedidos" },
  { href: "/pedidos/respostas", label: "Respostas das lojas", adminOnly: true },
];

export function PedidosTabs({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const tabs = TABS.filter((tab) => !tab.adminOnly || isAdmin);

  return (
    <div className="flex gap-1 border-b border-neutral-200">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
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
