import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/nav/sidebar";
import { fortalezaDateISO } from "@/lib/dates";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, sectors } = await requireUser();
  // menu lateral: fixo aberto só se a pessoa fixou (alfinete); senão fica recolhido, só os ícones
  const pinned = (await cookies()).get("sidebar-pinned")?.value === "1";

  let lateReportsCount = 0;
  if (profile.is_admin) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("store_stock_reports")
      .select("id", { count: "exact", head: true })
      .or("late_for_order_id.not.is.null,late_without_order.eq.true")
      .eq("late_acknowledged", false)
      .gt("delivery_date", fortalezaDateISO());
    lateReportsCount = count ?? 0;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile} sectors={sectors} lateReportsCount={lateReportsCount} initialPinned={pinned} />
      <main className="min-w-0 flex-1 p-6 md:p-8 print:p-0">{children}</main>
    </div>
  );
}
