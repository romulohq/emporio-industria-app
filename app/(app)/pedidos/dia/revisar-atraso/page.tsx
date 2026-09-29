import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { Button } from "@/components/ui/button";
import { diffDayOrders } from "@/lib/orders/diff-day-orders";
import { getUndecidedLateReports } from "@/lib/orders/late-reports";
import { regenerateWithLateReports } from "@/app/(app)/pedidos/dia/actions";
import { DiffList } from "@/components/orders/diff-list";
import { weekdayOfISODate, formatBrDate } from "@/lib/dates";
import { WEEKDAY_LABELS } from "@/lib/format/labels";
import type { Sector, SectorResponsible } from "@/lib/types/database.types";

export default async function RevisarAtrasoPage({
  searchParams,
}: {
  searchParams: Promise<{ sector?: string; date?: string; excluir?: string }>;
}) {
  await requireAdmin();
  const { sector: sectorId, date, excluir } = await searchParams;

  if (!sectorId || !date) {
    return <p className="p-6 text-sm text-neutral-500">Informe setor e data (?sector=ID&date=AAAA-MM-DD).</p>;
  }

  const excludeSet = new Set((excluir ?? "").split(",").filter(Boolean));

  const supabase = await createClient();
  const [{ data: sector }, { data: responsibles }, allLate] = await Promise.all([
    supabase.from("sectors").select("*").eq("id", sectorId).single(),
    supabase.from("sector_responsibles").select("*").eq("sector_id", sectorId),
    getUndecidedLateReports(),
  ]);

  const candidates = allLate.filter((r) => r.sectorId === sectorId && r.deliveryDate === date);
  const includeIds = candidates.filter((r) => !excludeSet.has(r.reportId)).map((r) => r.reportId);
  const excludeIds = candidates.filter((r) => excludeSet.has(r.reportId)).map((r) => r.reportId);

  const diff = await diffDayOrders(sectorId, date, excludeSet);
  const responsiblesById = Object.fromEntries(
    ((responsibles ?? []) as SectorResponsible[]).map((r) => [r.id, r])
  );

  const hasChanges =
    diff.entering.length + diff.increasing.length + diff.decreasing.length + diff.removed.length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/pedidos/dia" className="text-sm font-medium text-orange-700 hover:text-orange-800">
          ← Voltar
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">
          Revisar antes de gerar novamente — {(sector as Sector | null)?.name}
        </h1>
        <p className="text-sm text-neutral-500">
          {WEEKDAY_LABELS[weekdayOfISODate(date)]}, {formatBrDate(date)} · incluindo {includeIds.length} de{" "}
          {candidates.length} pedido(s) atrasado(s)
        </p>
      </div>

      {!hasChanges ? (
        <p className="text-sm text-neutral-500">
          Nada mudaria com essa seleção — os valores atrasados não alteram a ordem atual.
        </p>
      ) : (
        <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
          <DiffList title="Entram" items={diff.entering} tone="text-green-700" />
          <DiffList title="Aumentam" items={diff.increasing} tone="text-amber-700" />
          <DiffList title="Diminuem" items={diff.decreasing} tone="text-amber-700" />
          <DiffList title="Saem" items={diff.removed} tone="text-red-700" />

          {diff.byResponsible.size > 0 && (
            <div className="border-t border-neutral-100 pt-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Por colaborador</p>
              <ul className="space-y-1 text-sm text-neutral-700">
                {[...diff.byResponsible.entries()].map(([key, items]) => (
                  <li key={key}>
                    <span className="font-medium text-neutral-900">
                      {key === "sem" ? "Sem responsável" : responsiblesById[key]?.person_name ?? "?"}
                    </span>{" "}
                    — {items.length} produto(s) alterado(s)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <form action={regenerateWithLateReports} className="flex items-center gap-2">
        <input type="hidden" name="sector_id" value={sectorId} />
        <input type="hidden" name="delivery_date" value={date} />
        {includeIds.map((id) => (
          <input key={id} type="hidden" name="include_report_ids" value={id} />
        ))}
        {excludeIds.map((id) => (
          <input key={id} type="hidden" name="exclude_report_ids" value={id} />
        ))}
        <Button type="submit">Confirmar geração</Button>
        <Link href="/pedidos/dia" className="text-sm text-neutral-500 hover:text-neutral-800">
          Cancelar
        </Link>
      </form>
    </div>
  );
}
