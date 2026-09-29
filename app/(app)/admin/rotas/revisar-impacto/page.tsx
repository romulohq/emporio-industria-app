import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { Button } from "@/components/ui/button";
import { DiffList } from "@/components/orders/diff-list";
import { diffDayOrders } from "@/lib/orders/diff-day-orders";
import { hasDiffChanges } from "@/lib/orders/route-schedule-impact";
import { applyRouteScheduleImpact } from "@/app/(app)/admin/rotas/actions";
import { weekdayOfISODate, formatBrDate } from "@/lib/dates";
import { WEEKDAY_LABELS } from "@/lib/format/labels";
import type { ProductionUnit, Sector, SectorResponsible } from "@/lib/types/database.types";

export default async function RevisarImpactoRotaPage({
  searchParams,
}: {
  searchParams: Promise<{ unit_id?: string; sector_ids?: string | string[]; delivery_dates?: string | string[] }>;
}) {
  await requireAdmin();
  const { unit_id, sector_ids, delivery_dates } = await searchParams;

  const sectorIds = sector_ids ? (Array.isArray(sector_ids) ? sector_ids : [sector_ids]) : [];
  const deliveryDates = delivery_dates ? (Array.isArray(delivery_dates) ? delivery_dates : [delivery_dates]) : [];

  const supabase = await createClient();
  const { data: unit } = unit_id
    ? await supabase.from("production_units").select("*").eq("id", unit_id).maybeSingle()
    : { data: null as ProductionUnit | null };
  const backHref = `/admin/rotas${unit?.slug ? `?unit=${unit.slug}` : ""}`;

  if (!unit_id || sectorIds.length === 0 || sectorIds.length !== deliveryDates.length) {
    return (
      <div className="p-6">
        <p className="text-sm text-neutral-500">Nada para revisar.</p>
        <Link href={backHref} className="text-sm font-medium text-orange-700 hover:text-orange-800">
          ← Voltar
        </Link>
      </div>
    );
  }

  const pairs = sectorIds.map((sectorId, i) => ({ sectorId, deliveryDate: deliveryDates[i] }));

  const [{ data: sectors }, { data: responsibles }] = await Promise.all([
    supabase.from("sectors").select("*").in("id", [...new Set(sectorIds)]),
    supabase.from("sector_responsibles").select("*").in("sector_id", [...new Set(sectorIds)]),
  ]);
  const sectorsById = Object.fromEntries(((sectors ?? []) as Sector[]).map((s) => [s.id, s]));
  const responsiblesById = Object.fromEntries(
    ((responsibles ?? []) as SectorResponsible[]).map((r) => [r.id, r])
  );

  const groups = await Promise.all(
    pairs.map(async (pair) => ({ ...pair, diff: await diffDayOrders(pair.sectorId, pair.deliveryDate) }))
  );
  const changedGroups = groups.filter((g) => hasDiffChanges(g.diff));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href={backHref} className="text-sm font-medium text-orange-700 hover:text-orange-800">
          ← Voltar
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">
          Revisar impacto da mudança de rota
        </h1>
        <p className="text-sm text-neutral-500">
          A mudança que você salvou afeta pedidos já gerados. Escolha se quer aplicar agora ou manter os pedidos
          como estão (a mudança já está salva e vale a partir do próximo pedido gerado de qualquer forma).
        </p>
      </div>

      {changedGroups.length === 0 ? (
        <p className="text-sm text-neutral-500">Nada mudaria de fato nos pedidos já gerados.</p>
      ) : (
        <div className="space-y-4">
          {changedGroups.map((group) => (
            <div
              key={`${group.sectorId}:${group.deliveryDate}`}
              className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4"
            >
              <h2 className="text-sm font-semibold text-neutral-900">
                {sectorsById[group.sectorId]?.name} — {WEEKDAY_LABELS[weekdayOfISODate(group.deliveryDate)]},{" "}
                {formatBrDate(group.deliveryDate)}
              </h2>

              <DiffList title="Entram" items={group.diff.entering} tone="text-green-700" />
              <DiffList title="Aumentam" items={group.diff.increasing} tone="text-amber-700" />
              <DiffList title="Diminuem" items={group.diff.decreasing} tone="text-amber-700" />
              <DiffList title="Saem" items={group.diff.removed} tone="text-red-700" />

              {group.diff.byResponsible.size > 0 && (
                <div className="border-t border-neutral-100 pt-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    Por colaborador
                  </p>
                  <ul className="space-y-1 text-sm text-neutral-700">
                    {[...group.diff.byResponsible.entries()].map(([key, items]) => (
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
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        {changedGroups.length > 0 && (
          <form action={applyRouteScheduleImpact}>
            <input type="hidden" name="unit_id" value={unit_id} />
            {changedGroups.map((group) => (
              <span key={`${group.sectorId}:${group.deliveryDate}`}>
                <input type="hidden" name="sector_ids" value={group.sectorId} />
                <input type="hidden" name="delivery_dates" value={group.deliveryDate} />
              </span>
            ))}
            <Button type="submit">Aplicar agora</Button>
          </form>
        )}
        <Link href={backHref} className="text-sm text-neutral-500 hover:text-neutral-800">
          Manter pedido atual
        </Link>
      </div>
    </div>
  );
}
