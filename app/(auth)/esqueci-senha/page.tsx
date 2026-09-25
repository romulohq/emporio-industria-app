"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type ForgotPasswordState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ForgotPasswordState = undefined;

export default function EsqueciSenhaPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold text-neutral-900">Esqueci minha senha</h1>
        <p className="mb-6 text-sm text-neutral-500">
          Informe seu e-mail e enviaremos um link pra você criar uma nova senha.
        </p>

        {state?.success ? (
          <p className="text-sm text-green-700">
            Se esse e-mail estiver cadastrado, você vai receber um link de redefinição em
            instantes. Confira também a caixa de spam.
          </p>
        ) : (
          <form action={formAction} className="space-y-4">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>

            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Enviando..." : "Enviar link de redefinição"}
            </Button>
          </form>
        )}

        <Link
          href="/login"
          className="mt-6 block text-center text-sm text-orange-600 hover:underline"
        >
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
