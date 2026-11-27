import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/orders/print-button";
import { CountSheet } from "@/components/stock/count-sheet";
import { getOsorioCatalog } from "@/lib/stock/osorio";

export default async function FolhaDeContagemPage() {
  const supabase = await createClient();
  const { sectors, products } = await getOsorioCatalog(supabase);
  const groups = sectors
    .map((s) => ({ name: s.name, products: products.filter((p) => p.sector_id === s.id) }))
    .filter((g) => g.products.length > 0);

  return (
    <div className="space-y-4">
      <style>{`@media print { @page { size: A4 portrait; margin: 10mm; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>

      <div className="mx-auto flex max-w-[210mm] items-center justify-between print:hidden">
        <Link href="/estoque" className="text-sm font-medium text-orange-700 hover:text-orange-800">
          ← Contagem do dia
        </Link>
        <PrintButton />
      </div>

      <CountSheet groups={groups} />
    </div>
  );
}
