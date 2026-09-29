import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/nav/sidebar";
import { fortalezaDateISO } from "@/lib/dates";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, sectors } = await requireUser();

  let lateReportsCount = 0;
  if (profile.is_admin) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("store_stock_reports")
      .select("id", { count: "exact", head: true })
      .not("late_for_order_id", "is", null)
      .eq("late_acknowledged", false)
      .gt("delivery_date", fortalezaDateISO());
    lateReportsCount = count ?? 0;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile} sectors={sectors} lateReportsCount={lateReportsCount} />
      <main className="flex-1 p-6 md:p-8 print:p-0">{children}</main>
    </div>
  );
}
