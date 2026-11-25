import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/get-session";
import { Sidebar } from "@/components/nav/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, sectors } = await requireUser();
  // menu lateral: fixo aberto só se a pessoa fixou (alfinete); senão fica recolhido, só os ícones
  const pinned = (await cookies()).get("sidebar-pinned")?.value === "1";

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile} sectors={sectors} initialPinned={pinned} />
      <main className="min-w-0 flex-1 p-6 md:p-8 print:p-0">{children}</main>
    </div>
  );
}
