"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { pinnedQuery, usePinnedDate } from "@/lib/stock/pinned-date";

const TABS = [
  { base: "/estoque", page: "contagem", label: "Contagem do dia", param: "data" },
  { base: "/estoque/cronograma", page: "cronograma", label: "Cronograma de produção", param: "semana" },
  { base: "/estoque/mes", page: "mes", label: "Visão do mês", param: "mes" },
] as const;

export function EstoqueTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const pinned = usePinnedDate();

  // arriving from the menu (which knows nothing of the pin) on a page opened without its own
  // date: jump to the pinned one. A page that already carries its date is left alone, so moving
  // week by week or month by month inside a tab keeps working while pinned.
  useEffect(() => {
    if (!pinned) return;
    const tab = TABS.find((t) => t.base === pathname);
    if (!tab) return;
    if (new URLSearchParams(window.location.search).has(tab.param)) return;
    router.replace(`${tab.base}${pinnedQuery(tab.page, pinned)}`);
    // only when the page changes: the pin itself changing must not move the user around
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div className="flex gap-1 border-b border-neutral-200 print:hidden">
      {TABS.map((tab) => (
        <Link
          key={tab.base}
          href={`${tab.base}${pinnedQuery(tab.page, pinned)}`}
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
