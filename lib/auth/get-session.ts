import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Sector } from "@/lib/types/database.types";

export type SessionContext = {
  userId: string;
  email: string | null;
  profile: Profile;
  sectors: Sector[];
};

/**
 * Loads the current user's profile + sector memberships.
 * UX-level gating only — RLS is the real enforcement, this just
 * avoids rendering pages the user has no data access to.
 */
export async function requireUser(): Promise<SessionContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const { data: sectorLinks } = await supabase
    .from("user_sectors")
    .select("sectors(*)")
    .eq("user_id", user.id);

  const sectors = (sectorLinks ?? [])
    .map((link) => (link as unknown as { sectors: Sector }).sectors)
    .filter(Boolean);

  return { userId: user.id, email: user.email ?? null, profile, sectors };
}

export async function requireAdmin(): Promise<SessionContext> {
  const session = await requireUser();
  if (!session.profile.is_admin) {
    redirect("/dashboard");
  }
  return session;
}
