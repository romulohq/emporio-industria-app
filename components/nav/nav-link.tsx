"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Texto de um item do menu: some quando o menu está recolhido (só os ícones) e aparece ao expandir. */
export const labelClass =
  "whitespace-nowrap opacity-0 transition-opacity duration-150 group-data-[open=true]/sb:opacity-100";

/**
 * Visual dos itens do menu: texto grafite (a cor do logo), ícones finos; o item da seção atual (e o
 * que está sob o mouse) fica roxo, a cor do logo do Fabri.
 */
export const itemClass = (active: boolean) =>
  cn(
    "flex items-center gap-3 rounded-xl px-[15px] py-2.5 text-[15px] transition-colors hover:bg-[#f1efff] hover:text-[#6b5be6]",
    active ? "bg-[#f1efff] text-[#6b5be6]" : "text-[#1c1c24]"
  );

/**
 * Item do menu lateral. O item da seção em que a pessoa está fica destacado, o que também ajuda com
 * o menu recolhido, em que só os ícones aparecem.
 */
export function NavLink({
  href,
  label,
  icon,
  badge = 0,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** contador (ex.: relatórios atrasados); com o menu recolhido vira uma bolinha sobre o ícone */
  badge?: number;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={itemClass(active)}
    >
      <span className="relative flex shrink-0">
        {icon}
        {badge > 0 && (
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-orange-600 ring-2 ring-white group-data-[open=true]/sb:hidden" />
        )}
      </span>
      <span className={labelClass}>{label}</span>
      {badge > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-600 px-1 text-xs font-bold text-white opacity-0 transition-opacity duration-150 group-data-[open=true]/sb:opacity-100">
          {badge}
        </span>
      )}
    </Link>
  );
}
