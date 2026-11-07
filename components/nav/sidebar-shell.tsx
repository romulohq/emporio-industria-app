"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const COOKIE = "sidebar-pinned";

/**
 * Casca do menu lateral: recolhido mostra só os ícones; ao passar o mouse ele se expande por cima da
 * página; o botão de travar fixa o menu aberto (a escolha fica salva num cookie, lido pelo servidor para a
 * página já abrir do jeito certo).
 */
export function SidebarShell({ initialPinned, children }: { initialPinned: boolean; children: React.ReactNode }) {
  const [pinned, setPinned] = useState(initialPinned);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const open = pinned || hover || focused;

  function togglePinned() {
    const next = !pinned;
    setPinned(next);
    document.cookie = `${COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    // espaço que o menu ocupa na página; ao expandir só passando o mouse, ele cobre o conteúdo em vez de empurrá-lo
    <div
      className={cn(
        "sticky top-0 z-40 h-screen shrink-0 self-start transition-[width] duration-200 print:hidden",
        pinned ? "w-64" : "w-[4.5rem]"
      )}
    >
      <aside
        data-open={open}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        // foco pelo teclado também expande; o foco deixado por um clique não prende o menu aberto
        onFocus={(e) => setFocused(e.target.matches(":focus-visible"))}
        onBlur={() => setFocused(false)}
        className={cn(
          "group/sb absolute inset-y-0 left-0 overflow-hidden border-r border-neutral-200/70 bg-white transition-[width,box-shadow] duration-200",
          open ? "w-64" : "w-[4.5rem]",
          open && !pinned && "shadow-xl shadow-neutral-900/10"
        )}
      >
        <div className="flex h-full w-64 flex-col">
          <div className="flex h-16 shrink-0 items-center px-[13px]">
            <Link
              href="/dashboard"
              aria-label="Time Fábrica"
              className={cn(
                "block h-7 shrink-0 overflow-hidden transition-[width] duration-200",
                open ? "w-[119px]" : "w-[45px]"
              )}
            >
              <Image
                src="/time-fabrica-logo-laranja-suave.png"
                alt="Time Fábrica"
                width={1200}
                height={282}
                priority
                className="h-7 w-auto max-w-none"
              />
            </Link>
            <button
              type="button"
              onClick={togglePinned}
              aria-pressed={pinned}
              aria-label={pinned ? "Recolher menu (deixar de fixar)" : "Fixar menu aberto"}
              title={pinned ? "Recolher menu: deixa de ficar fixo" : "Fixar menu aberto"}
              className={cn(
                "ml-auto flex h-8 w-8 items-center justify-center rounded-lg transition-opacity duration-150 hover:bg-orange-50",
                open ? "opacity-100" : "pointer-events-none opacity-0",
                pinned ? "text-orange-600" : "text-neutral-400 hover:text-orange-600"
              )}
              tabIndex={open ? 0 : -1}
            >
              {pinned ? <PanelLeftClose className="h-[18px] w-[18px]" /> : <PanelLeftOpen className="h-[18px] w-[18px]" />}
            </button>
          </div>
          {children}
        </div>
      </aside>
    </div>
  );
}
