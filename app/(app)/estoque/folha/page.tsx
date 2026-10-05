import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/orders/print-button";
import { getOsorioCatalog } from "@/lib/stock/osorio";

export default async function FolhaDeContagemPage() {
  const supabase = await createClient();
  const { sectors, products } = await getOsorioCatalog(supabase);
  const groups = sectors
    .map((s) => ({ name: s.name, products: products.filter((p) => p.sector_id === s.id) }))
    .filter((g) => g.products.length > 0);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/estoque" className="text-sm font-medium text-orange-700 hover:text-orange-800">
          ← Contagem do dia
        </Link>
        <PrintButton />
      </div>

      <header className="border-b border-neutral-300 pb-3">
        <h1 className="text-lg font-bold uppercase tracking-wide text-neutral-900">Contagem de produtos da câmara</h1>
        <div className="mt-3 flex flex-wrap gap-x-10 gap-y-2 text-sm text-neutral-700">
          <span>Data: ____ / ____ / ________</span>
          <span>Responsável: ______________________</span>
        </div>
      </header>

      <div className="columns-2 gap-8">
        {groups.map((group) => (
          <section key={group.name} className="mb-4 break-inside-avoid">
            <h2 className="mb-1 border-b border-neutral-400 pb-0.5 text-[11px] font-bold uppercase tracking-wider text-neutral-600">
              {group.name}
            </h2>
            <table className="w-full text-[11px]">
              <tbody>
                {group.products.map((p) => (
                  <tr key={p.id} className="border-b border-neutral-200">
                    <td className="py-1 pr-2 text-neutral-900">{p.name}</td>
                    <td className="w-14 border-l border-neutral-200 py-1 text-right text-neutral-300">cx</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  );
}
