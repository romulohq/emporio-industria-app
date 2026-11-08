import {
  LayoutDashboard,
  Package,
  Boxes,
  ClipboardList,
  History,
  ShoppingCart,
  BarChart3,
  FileUp,
  Tags,
  Users,
  Building2,
  Store,
  Route,
  LogOut,
} from "lucide-react";
import { signOut } from "@/app/(auth)/login/actions";
import { NavLink, labelClass } from "@/components/nav/nav-link";
import { SidebarGroup } from "@/components/nav/sidebar-group";
import { SidebarShell } from "@/components/nav/sidebar-shell";
import type { Profile, Sector } from "@/lib/types/database.types";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** submenu that opens when the item is clicked */
  children?: { href: string; label: string }[];
  /** address prefix of the item's section (the submenu stays open inside it) */
  basePath?: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/produtos", label: "Produtos", icon: Package },
  { href: "/estoque", label: "Estoque", icon: Boxes },
  { href: "/pedidos", label: "Pedidos", icon: ClipboardList },
  {
    href: "/compras/hortifrut",
    label: "Compras",
    icon: ShoppingCart,
    basePath: "/compras",
    children: [{ href: "/compras/hortifrut", label: "Hortifrut" }],
  },
  { href: "/produtividade", label: "Produtividade", icon: BarChart3 },
  { href: "/historico", label: "Histórico", icon: History },
];

const ADMIN_ITEMS = [
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/setores", label: "Setores", icon: Building2 },
  { href: "/admin/lojas", label: "Lojas", icon: Store },
  { href: "/admin/rotas", label: "Rotas", icon: Route },
  { href: "/importar-erp", label: "Importar ERP", icon: FileUp },
  { href: "/cadastro-produtos-erp", label: "Produtos ERP", icon: Tags },
];

const ICON = "h-[18px] w-[18px]";

export function Sidebar({
  profile,
  sectors,
  lateReportsCount = 0,
  initialPinned = false,
}: {
  profile: Profile;
  sectors: Sector[];
  lateReportsCount?: number;
  /** menu fixo aberto (escolha da pessoa, guardada num cookie) */
  initialPinned?: boolean;
}) {
  return (
    <SidebarShell initialPinned={initialPinned}>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-2">
        {NAV_ITEMS.map((item) =>
          item.children ? (
            <SidebarGroup
              key={item.label}
              label={item.label}
              icon={<item.icon className={ICON} strokeWidth={2} />}
              basePath={item.basePath ?? item.href}
              items={item.children}
            />
          ) : (
            <NavLink
              key={item.href + item.label}
              href={item.href}
              label={item.label}
              icon={<item.icon className={ICON} strokeWidth={2} />}
              badge={item.href === "/pedidos" ? lateReportsCount : 0}
            />
          )
        )}

        {profile.is_admin && (
          <>
            {/* recolhido, o título vira uma linha fina que separa o bloco */}
            <div className="relative mb-1 mt-5 h-5">
              <p
                className={`absolute inset-x-0 top-0 px-3 text-xs font-semibold uppercase tracking-wide text-neutral-400 ${labelClass}`}
              >
                ADM
              </p>
              <hr className="absolute inset-x-3 top-2.5 border-neutral-200 group-data-[open=true]/sb:hidden" />
            </div>
            {ADMIN_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={<item.icon className={ICON} strokeWidth={2} />}
              />
            ))}
          </>
        )}
      </nav>

      {/* aberto: cartão com o usuário; recolhido: só o botão de sair */}
      <div className="m-3 rounded-xl bg-neutral-50 p-3 group-data-[open=false]/sb:hidden">
        <p className="truncate text-sm font-semibold text-neutral-800">{profile.full_name ?? profile.email}</p>
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
      <form action={signOut} className="m-3 group-data-[open=true]/sb:hidden">
        <button
          type="submit"
          title="Sair"
          aria-label="Sair"
          className="flex h-10 w-12 items-center justify-center rounded-xl text-neutral-500 hover:bg-orange-50 hover:text-orange-700"
        >
          <LogOut className={ICON} strokeWidth={2} />
        </button>
      </form>
    </SidebarShell>
  );
}
