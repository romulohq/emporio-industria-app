"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { usePinnedDate } from "@/lib/stock/pinned-date";

const TABS = [
  { base: "/estoque", page: "contagem", label: "Contagem do dia" },
  { base: "/estoque/cronograma", page: "cronograma", label: "Cronograma de produção" },
  { base: "/estoque/mes", page: "mes", label: "Visão do mês" },
] as const;

export function EstoqueTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const pinned = usePinnedDate();

  // the pin only concerns the daily count: arriving from the menu (which knows nothing of the
  // pin) on it without a date, jump to the pinned one. The other tabs ignore the pin.
  useEffect(() => {
    if (!pinned || pathname !== "/estoque") return;
    if (new URLSearchParams(window.location.search).has("data")) return;
    router.replace(`/estoque?data=${pinned}`);
    // only when the page changes: the pin itself changing must not move the user around
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div className="flex gap-1 border-b border-neutral-200 print:hidden">
      {TABS.map((tab) => (
        <Link
          key={tab.base}
          href={tab.page === "contagem" && pinned ? `${tab.base}?data=${pinned}` : tab.base}
          className={cn(
            "border-b-2 px-3 py-2 text-sm font-medium",
            pathname === tab.base
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
