"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { path: "", label: "Monitor" },
  { path: "/dia", label: "Ordem do dia" },
  { path: "/respostas", label: "Respostas das lojas", adminOnly: true },
  { path: "/dia/historico", label: "Histórico de pedidos" },
];

export function PedidosTabs({ isAdmin = false, basePath = "/pedidos" }: { isAdmin?: boolean; basePath?: string }) {
  const pathname = usePathname();
  const tabs = TABS.filter((tab) => !tab.adminOnly || isAdmin);

  return (
    <div className="flex gap-1 border-b border-neutral-200">
      {tabs.map((tab) => {
        const href = `${basePath}${tab.path}`;
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
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
