import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-session";
import { PrintButton } from "@/components/orders/print-button";
import { CollaboratorPicker } from "@/components/orders/collaborator-picker";
import { CollaboratorSheet, type CollaboratorSheetItem } from "@/components/orders/collaborator-sheet";
import { weekdayOfISODate, formatBrDate } from "@/lib/dates";
import { WEEKDAY_LABELS } from "@/lib/format/labels";
import type { Product, ProductionOrder, Sector, SectorResponsible } from "@/lib/types/database.types";

type Sheet = { key: string; title: string; items: CollaboratorSheetItem[] };

export default async function ImprimirPorColaboradorPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; sector?: string; responsavel?: string; alterados?: string; versao?: string }>;
}) {
  await requireUser();
  const { date, sector: sectorId, responsavel, alterados, versao } = await searchParams;
  const supabase = await createClient();

  if (!date || !sectorId) {
    return (
      <p className="p-6 text-sm text-neutral-500">Informe data e setor (?date=AAAA-MM-DD&sector=ID) na URL.</p>
    );
  }

  const [{ data: sector }, { data: orders }, { data: responsibles }] = await Promise.all([
    supabase.from("sectors").select("*").eq("id", sectorId).single(),
    supabase
      .from("production_orders")
      .select("*")
      .eq("source", "auto_route")
      .eq("delivery_date", date)
      .eq("sector_id", sectorId)
      .in("status", ["pending", "in_progress", "completed"]),
    supabase.from("sector_responsibles").select("*").eq("sector_id", sectorId).order("display_order"),
  ]);

  const ordersList = (orders ?? []) as ProductionOrder[];
  const productIds = ordersList.map((o) => o.product_id);
  const { data: products } = productIds.length
    ? await supabase.from("products").select("*").in("id", productIds)
    : { data: [] as Product[] };
  const productsById = Object.fromEntries(((products ?? []) as Product[]).map((p) => [p.id, p]));

  const activeResponsibles = ((responsibles ?? []) as SectorResponsible[]).filter((r) => r.active);
  const activeResponsibleIds = new Set(activeResponsibles.map((r) => r.id));

  const itemsByResponsible = new Map<string, CollaboratorSheetItem[]>();
  const unassignedItems: CollaboratorSheetItem[] = [];

  for (const order of ordersList) {
    const product = productsById[order.product_id];
    if (!product) continue;
    const item: CollaboratorSheetItem = {
      id: order.id,
      name: product.name,
      unit: product.unit,
      quantity: order.quantity,
    };
    if (product.responsible_id && activeResponsibleIds.has(product.responsible_id)) {
      const list = itemsByResponsible.get(product.responsible_id) ?? [];
      list.push(item);
      itemsByResponsible.set(product.responsible_id, list);
    } else {
      unassignedItems.push(item);
    }
  }

  const sortByName = (items: CollaboratorSheetItem[]) => [...items].sort((a, b) => a.name.localeCompare(b.name));

  const sheets: Sheet[] = [];
  for (const r of activeResponsibles) {
    const items = itemsByResponsible.get(r.id) ?? [];
    if (items.length === 0) continue;
    sheets.push({
      key: r.id,
      title: `${r.role_name.toUpperCase()} — ${r.person_name.toUpperCase()}`,
      items: sortByName(items),
    });
  }
  if (unassignedItems.length > 0) {
    sheets.push({ key: "sem", title: "PRODUTOS SEM RESPONSÁVEL", items: sortByName(unassignedItems) });
  }

  const alteredKeys = alterados ? new Set(alterados.split(",").filter(Boolean)) : null;
  const visibleSheets = responsavel
    ? sheets.filter((s) => s.key === responsavel)
    : alteredKeys
      ? sheets.filter((s) => alteredKeys.has(s.key))
      : sheets;

  const sectorName = (sector as Sector | null)?.name ?? "";
  const weekdayLabel = WEEKDAY_LABELS[weekdayOfISODate(date)];
  const brDate = formatBrDate(date);

  const pickerOptions = [
    ...activeResponsibles.map((r) => ({ value: r.id, label: `${r.role_name} — ${r.person_name}` })),
    ...(unassignedItems.length > 0 ? [{ value: "sem", label: "Sem responsável" }] : []),
  ];

  return (
    <div className="space-y-6 p-6 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/pedidos/dia" className="text-sm font-medium text-orange-700 hover:text-orange-800">
          ← Voltar
        </Link>
        <div className="flex items-center gap-2">
          <CollaboratorPicker date={date} sectorId={sectorId} options={pickerOptions} />
          <PrintButton />
        </div>
      </div>

      {(alteredKeys || versao) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 print:hidden">
          {versao && <p className="font-semibold">Versão {versao} — a ordem foi gerada novamente.</p>}
          {alteredKeys && (
            <p>
              Mostrando só as folhas que mudaram nesta versão. Folhas já impressas antes desta atualização estão
              desatualizadas.{" "}
              <Link
                href={`/pedidos/dia/imprimir-colaboradores?date=${date}&sector=${sectorId}`}
                className="font-medium underline"
              >
                Ver todas as folhas
              </Link>
            </p>
          )}
        </div>
      )}

      {visibleSheets.length === 0 && (
        <p className="text-sm text-neutral-500">Nenhuma folha pra mostrar — a ordem está vazia ou já concluída.</p>
      )}

      {visibleSheets.map((sheet, index) => (
        <CollaboratorSheet
          key={sheet.key}
          subtitle={`${sectorName} · ${weekdayLabel}, ${brDate}`}
          title={sheet.title}
          items={sheet.items}
          isFirst={index === 0}
        />
      ))}
    </div>
  );
}
