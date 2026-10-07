import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-session";
import { EstoqueTabs } from "@/components/stock/estoque-tabs";
import { ScheduleGrid, type GridItem } from "@/components/stock/schedule-grid";
import { addDaysISO, fortalezaDateISO, formatBrDate } from "@/lib/dates";
import { defaultWeekStart, weekDatesOf, weekStartOf } from "@/lib/schedule/week";
import type { ScheduleCell, ScheduleItem, ScheduleWeek } from "@/lib/types/database.types";

export default async function CronogramaPage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const { profile, sectors: mySectors } = await requireUser();
  const { semana } = await searchParams;
  const weekStart =
    semana && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? weekStartOf(semana) : defaultWeekStart(fortalezaDateISO());
  const dates = weekDatesOf(weekStart);

  const supabase = await createClient();
  const [{ data: items }, { data: cells }, { data: weekRow }, { data: previousWeek }, { data: unit }] = await Promise.all([
    supabase.from("schedule_items").select("*").eq("active", true).order("position"),
    supabase.from("schedule_cells").select("*").eq("week_start", weekStart),
    supabase.from("schedule_weeks").select("*").eq("week_start", weekStart).maybeSingle(),
    supabase
      .from("schedule_weeks")
      .select("notes")
      .lt("week_start", weekStart)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("production_units").select("id").eq("slug", "osorio-de-paiva").single(),
  ]);

  const canEdit = profile.is_admin || mySectors.some((s) => s.unit_id === unit?.id);
  const week = weekRow as ScheduleWeek | null;

  const cellMap: Record<string, string> = {};
  for (const c of (cells ?? []) as ScheduleCell[]) cellMap[`${c.item_id}:${c.weekday}`] = c.label;

  const gridItems: GridItem[] = ((items ?? []) as ScheduleItem[]).map((i) => ({
    id: i.id,
    section: i.section,
    name: i.name,
  }));

  const prev = addDaysISO(weekStart, -7);
  const next = addDaysISO(weekStart, 7);

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <h1 className="text-xl font-semibold text-neutral-900">Estoque</h1>
        <p className="text-sm text-neutral-500">Fábrica Osório de Paiva</p>
      </div>

      <EstoqueTabs />

      <div className="flex items-center gap-1 print:hidden">
        <Link
          href={`/estoque/cronograma?semana=${prev}`}
          className="rounded p-1 text-neutral-500 hover:bg-neutral-100"
          aria-label="Semana anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <span className="min-w-44 text-center text-sm font-semibold text-neutral-900">
          Semana {formatBrDate(dates[0])} a {formatBrDate(dates[4])}
        </span>
        <Link
          href={`/estoque/cronograma?semana=${next}`}
          className="rounded p-1 text-neutral-500 hover:bg-neutral-100"
          aria-label="Próxima semana"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <ScheduleGrid
        key={weekStart}
        weekStart={weekStart}
        dates={dates}
        items={gridItems}
        initialCells={cellMap}
        initialHolidays={week?.holidays ?? []}
        initialNotes={week?.notes ?? previousWeek?.notes ?? ""}
        canEdit={canEdit}
      />
    </div>
  );
}
