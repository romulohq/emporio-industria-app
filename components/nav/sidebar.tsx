import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  Boxes,
  ClipboardList,
  History,
  Users,
  Building2,
  Store,
  Route,
  LogOut,
} from "lucide-react";
import { signOut } from "@/app/(auth)/login/actions";
import type { Profile, Sector } from "@/lib/types/database.types";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/produtos", label: "Produtos", icon: Package },
  { href: "/estoque", label: "Estoque", icon: Boxes },
  { href: "/pedidos", label: "Ordens de produção", icon: ClipboardList },
  { href: "/historico", label: "Histórico", icon: History },
];

const ADMIN_ITEMS = [
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/setores", label: "Setores", icon: Building2 },
  { href: "/admin/lojas", label: "Lojas", icon: Store },
  { href: "/admin/rotas", label: "Rotas", icon: Route },
];

export function Sidebar({ profile, sectors }: { profile: Profile; sectors: Sector[] }) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-neutral-200/70 bg-white print:hidden">
      <div className="flex items-center gap-2.5 p-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-600 text-sm font-extrabold text-white">
          EP
        </span>
        <div>
          <p className="text-sm font-extrabold leading-tight text-neutral-900">Empório do Pão</p>
          <p className="text-xs text-neutral-500">Estoque &amp; Produção</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-orange-50 hover:text-orange-700"
          >
            <item.icon className="h-[18px] w-[18px]" strokeWidth={2} />
            {item.label}
          </Link>
        ))}

        {profile.is_admin && (
          <>
            <p className="mt-5 mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Administração
            </p>
            {ADMIN_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-orange-50 hover:text-orange-700"
              >
                <item.icon className="h-[18px] w-[18px]" strokeWidth={2} />
                {item.label}
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="m-3 rounded-xl bg-neutral-50 p-3">
        <p className="truncate text-sm font-semibold text-neutral-800">
          {profile.full_name ?? profile.email}
        </p>
        <p className="mb-3 truncate text-xs text-neutral-500">
          {profile.is_admin ? "Administrador" : sectors.map((s) => s.name).join(", ") || "Sem setor"}
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
