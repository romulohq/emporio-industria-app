"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = undefined;

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold text-neutral-900">Empório do Pão</h1>
        <p className="mb-6 text-sm text-neutral-500">Controle de estoque e produção</p>

        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <Link href="/esqueci-senha" className="text-xs text-orange-600 hover:underline">
                Esqueci minha senha
              </Link>
            </div>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </div>

          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
