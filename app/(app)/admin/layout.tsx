import { requireAdmin } from "@/lib/auth/get-session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
