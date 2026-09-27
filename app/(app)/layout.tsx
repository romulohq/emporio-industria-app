import { requireUser } from "@/lib/auth/get-session";
import { Sidebar } from "@/components/nav/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, sectors } = await requireUser();

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile} sectors={sectors} />
      <main className="flex-1 p-6 md:p-8 print:p-0">{children}</main>
    </div>
  );
}
