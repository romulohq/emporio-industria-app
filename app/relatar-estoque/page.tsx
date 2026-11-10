import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { openStoreForm } from "./actions";

export const metadata: Metadata = {
  title: "Relatar estoque Confeitaria e Pães embalados",
  robots: { index: false, follow: false },
};

export default async function EscolherLojaPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const admin = createAdminClient();
  const { data: stores } = await admin.from("stores").select("id, name").eq("active", true).order("name");

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-8">
      <form action={openStoreForm} className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Relatar estoque Confeitaria e Pães embalados</h1>
          <p className="mt-1 text-sm text-neutral-500">Escolha a sua loja para abrir o formulário de pedido.</p>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">Loja</span>
          <select
            name="store"
            required
            defaultValue=""
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-base text-neutral-900 focus:border-orange-600 focus:outline-none focus:ring-1 focus:ring-orange-600"
          >
            <option value="" disabled>
              Selecione a loja
            </option>
            {(stores ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {erro && <p className="text-sm text-red-600">Não foi possível abrir essa loja. Escolha de novo.</p>}
        <button
          type="submit"
          className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
        >
          Abrir formulário
        </button>
      </form>
    </div>
  );
}
