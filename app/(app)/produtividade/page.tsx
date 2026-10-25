import { requireUser } from "@/lib/auth/get-session";

export default async function ProdutividadePage() {
  await requireUser();

  return (
    <iframe
      src="/relatorios/produtividade-congelados.html"
      title="Produtividade Fábrica Congelados"
      className="block h-[calc(100dvh-3rem)] w-full rounded-xl border border-neutral-200 bg-white md:h-[calc(100dvh-4rem)]"
    />
  );
}
