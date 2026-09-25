"use server";

import { createClient } from "@/lib/supabase/server";
import { forgotPasswordSchema } from "@/lib/validations/auth";

export type ForgotPasswordState = { error?: string; success?: boolean } | undefined;

export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "E-mail inválido" };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/redefinir-senha`,
  });

  // Supabase itself never errors just because the e-mail isn't registered
  // (that's intentional, to avoid leaking which e-mails have accounts) —
  // an error here means the request genuinely failed (network, rate limit).
  if (error) {
    return { error: "Não foi possível enviar o e-mail agora. Tente novamente em instantes." };
  }

  return { success: true };
}
