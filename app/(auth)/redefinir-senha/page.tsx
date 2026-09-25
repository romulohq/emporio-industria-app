"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

type Status = "checking" | "ready" | "invalid" | "done";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStatus("ready");
    });

    // Covers the case where the PASSWORD_RECOVERY event already fired
    // before this listener was attached.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStatus((s) => (s === "checking" ? "ready" : s));
    });

    const timeout = setTimeout(() => {
      setStatus((s) => (s === "checking" ? "invalid" : s));
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const parsed = resetPasswordSchema.safeParse({
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    setPending(false);

    if (updateError) {
      setError("Não foi possível redefinir a senha. Tente pedir um novo link.");
      return;
    }

    setStatus("done");
    await supabase.auth.signOut();
    setTimeout(() => router.push("/login"), 2000);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold text-neutral-900">Nova senha</h1>

        {status === "checking" && (
          <p className="text-sm text-neutral-500">Verificando o link...</p>
        )}

        {status === "invalid" && (
          <div className="space-y-4">
            <p className="text-sm text-red-600">
              Esse link é inválido ou já expirou. Peça um novo link de redefinição.
            </p>
            <Link href="/esqueci-senha" className="text-sm text-orange-600 hover:underline">
              Pedir novo link
            </Link>
          </div>
        )}

        {status === "ready" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">Nova senha</Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                required
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        )}

        {status === "done" && (
          <p className="text-sm text-green-700">
            Senha atualizada! Levando você pro login...
          </p>
        )}
      </div>
    </div>
  );
}
