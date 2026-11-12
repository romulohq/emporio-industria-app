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
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-3 py-6 sm:px-4 sm:py-8">
      <form
        action={openStoreForm}
        className="w-full max-w-lg space-y-7 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <div>
          <h1 className="text-[26px] font-bold leading-tight text-neutral-900">Relatar estoque Confeitaria e Pães embalados</h1>
          <p className="mt-2 text-base text-neutral-500">Escolha a sua loja para abrir o formulário de pedido.</p>
        </div>
        <label className="block">
          <span className="text-lg font-semibold text-neutral-800">Loja</span>
          <select
            name="store"
            required
            defaultValue=""
            className="mt-2 h-16 w-full rounded-xl border border-neutral-300 bg-white px-4 text-xl text-neutral-900 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-600/40"
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
        {erro && <p className="text-base text-red-600">Não foi possível abrir essa loja. Escolha de novo.</p>}
        <button
          type="submit"
          className="h-16 w-full rounded-xl bg-orange-600 px-4 text-xl font-semibold text-white hover:bg-orange-700"
        >
          Abrir formulário
        </button>
      </form>
    </div>
  );
}
