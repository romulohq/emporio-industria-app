import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/nav/sidebar";
import { fortalezaDateISO } from "@/lib/dates";
import { loadUnitScope } from "@/lib/orders/unit-scope";
import { OSORIO_ORDERS, RUI_ORDERS } from "@/lib/orders/units";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, sectors } = await requireUser();
  // menu lateral: fixo aberto só se a pessoa fixou (alfinete); senão fica recolhido, só os ícones
  const pinned = (await cookies()).get("sidebar-pinned")?.value === "1";

  // pedidos atrasados esperando aprovação, de cada frente (Rui e Osório) com as lojas dela
  let lateReportsCount = 0;
  let osorioLateReportsCount = 0;
  if (profile.is_admin) {
    const supabase = await createClient();
    const countFor = async (ctx: typeof RUI_ORDERS) => {
      const { storeIds } = await loadUnitScope(supabase, ctx);
      if (storeIds.size === 0) return 0;
      const { count } = await supabase
        .from("store_stock_reports")
        .select("id", { count: "exact", head: true })
        .in("store_id", [...storeIds])
        .or("late_for_order_id.not.is.null,late_without_order.eq.true")
        .eq("late_acknowledged", false)
        .gt("delivery_date", fortalezaDateISO());
      return count ?? 0;
    };
    [lateReportsCount, osorioLateReportsCount] = await Promise.all([countFor(RUI_ORDERS), countFor(OSORIO_ORDERS)]);
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile} sectors={sectors} lateReportsCount={lateReportsCount} osorioLateReportsCount={osorioLateReportsCount} initialPinned={pinned} />
      <main className="min-w-0 flex-1 p-6 md:p-8 print:p-0">{children}</main>
    </div>
  );
}
