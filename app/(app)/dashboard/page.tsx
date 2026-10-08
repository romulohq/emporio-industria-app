import Link from "next/link";
import { AlertTriangle, CalendarDays, Factory, Wheat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-session";
import { Card, CardContent, CardHeader, CardIcon, CardTitle } from "@/components/ui/card";
import { CoverageBar } from "@/components/stock/coverage-bar";
import { getOsorioCatalog } from "@/lib/stock/osorio";
import { coverageOf } from "@/lib/stock/coverage";
import { latestCountByProduct, productsRunningLow, type CountLike } from "@/lib/stock/low-supply";
import { upcomingHolidays } from "@/lib/holidays";
import { SCHEDULE_SECTIONS, labelTone, weekStartOf, type LabelTone } from "@/lib/schedule/week";
import { addDaysISO, fortalezaDateISO, formatBrDate, weekdayOfISODate } from "@/lib/dates";
import { WEEKDAY_ORDER, WEEKDAY_LABELS, formatQuantity } from "@/lib/format/labels";
import type { ScheduleCell, ScheduleItem, ScheduleWeek } from "@/lib/types/database.types";

const MONTH_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const LOW_LIST_SIZE = 8;

const CHIP: Record<LabelTone, string> = {
  produce: "bg-orange-100 text-orange-800",
  prep: "bg-amber-50 text-amber-800",
  thaw: "bg-sky-100 text-sky-800",
  free: "bg-neutral-100 text-neutral-700",
};

function greetingName(fullName: string | null, email: string | null) {
  const source = fullName ?? email ?? "";
  const first = source.split(" ")[0].split("@")[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export default async function DashboardPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const todayISO = fortalezaDateISO();
  const todayWeekday = weekdayOfISODate(todayISO);
  const weekdayNumber = WEEKDAY_ORDER.indexOf(todayWeekday) + 1; // Monday = 1 ... Sunday = 7
  const weekStart = weekStartOf(todayISO);
  const isWorkday = weekdayNumber <= 5;

  const [{ products }, { data: recentCounts }, { data: todayCells }, { data: scheduleItems }, { data: weekRow }] =
    await Promise.all([
      getOsorioCatalog(supabase),
      supabase
        .from("stock_counts")
        .select("product_id, count_date, stock_units, boxes")
        .gte("count_date", addDaysISO(todayISO, -14))
        .order("count_date", { ascending: false }),
      isWorkday
        ? supabase.from("schedule_cells").select("*").eq("week_start", weekStart).eq("weekday", weekdayNumber)
        : Promise.resolve({ data: [] as ScheduleCell[] }),
      supabase.from("schedule_items").select("*").eq("active", true).order("position"),
      supabase.from("schedule_weeks").select("*").eq("week_start", weekStart).maybeSingle(),
    ]);

  // --- card: products about to run out (under 20% of the minimum) ---
  const counts = (recentCounts ?? []) as (CountLike & { boxes: number })[];
  const latest = latestCountByProduct(counts);
  const running = productsRunningLow(products, latest);

  // --- card: pão carioca ---
  const carioca = products.find((p) => /^PÃO CARIOCA/i.test(p.name) && !/INTEGRAL/i.test(p.name));
  let cariocaCount: (CountLike & { boxes: number }) | null = null;
  if (carioca) {
    const { data } = await supabase
      .from("stock_counts")
      .select("product_id, count_date, stock_units, boxes")
      .eq("product_id", carioca.id)
      .order("count_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    cariocaCount = (data as (CountLike & { boxes: number }) | null) ?? null;
  }
  const cariocaCoverage = carioca && cariocaCount ? coverageOf(Number(cariocaCount.stock_units), Number(carioca.min_quantity)) : null;

  // --- card: what is being produced today, from the weekly schedule ---
  const week = weekRow as ScheduleWeek | null;
  const isHoliday = isWorkday && (week?.holidays ?? []).includes(weekdayNumber);
  const itemsById = new Map(((scheduleItems ?? []) as ScheduleItem[]).map((i) => [i.id, i]));
  const todayProduction = SCHEDULE_SECTIONS.map((section) => ({
    label: section.label,
    rows: ((todayCells ?? []) as ScheduleCell[])
      .map((c) => ({ cell: c, item: itemsById.get(c.item_id) }))
      .filter((r): r is { cell: ScheduleCell; item: ScheduleItem } => !!r.item && r.item.section === section.key)
      .sort((a, b) => a.item.position - b.item.position),
  })).filter((s) => s.rows.length > 0);

  const holidays = upcomingHolidays(todayISO, 4);

  const todayRaw = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Fortaleza",
  }).format(new Date());
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 p-6 text-white shadow-lg sm:p-8">
        <h1 className="text-2xl font-extrabold sm:text-3xl">
          Olá, {greetingName(profile.full_name, profile.email)}, bem-vindo(a)!
        </h1>
        <p className="mt-1 text-sm text-white/80">{today}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="justify-between">
            <div className="flex items-center gap-3">
              <CardIcon tone="red">
                <AlertTriangle className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </CardIcon>
              <CardTitle>Produtos próximos de acabar</CardTitle>
            </div>
            <Link href="/estoque" className="text-xs font-semibold text-orange-600 hover:underline">
              Ver contagem
            </Link>
          </CardHeader>
          <CardContent>
            {latest.size === 0 ? (
              <p className="text-sm text-neutral-500">
                Ainda não há contagens recentes. Faça a contagem do dia em Estoque.
              </p>
            ) : running.length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhum produto abaixo de 20% do mínimo. 🎉</p>
            ) : (
              <>
                <p className="mb-3 text-xs text-neutral-400">Abaixo de 20% do estoque mínimo</p>
                <ul className="space-y-2.5">
                  {running.slice(0, LOW_LIST_SIZE).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-neutral-900">{p.name}</p>
                        <p className="text-xs text-neutral-400">
                          {formatQuantity(p.stock, p.unit)} / mín. {formatQuantity(p.min, p.unit)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">
                        {Math.round(p.ratio * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
                {running.length > LOW_LIST_SIZE && (
                  <p className="mt-3 text-xs text-neutral-400">+ {running.length - LOW_LIST_SIZE} outros produtos</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="justify-between">
            <div className="flex items-center gap-3">
              <CardIcon tone="orange">
                <Factory className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </CardIcon>
              <CardTitle>Produções de hoje</CardTitle>
            </div>
            <Link href="/estoque/cronograma" className="text-xs font-semibold text-orange-600 hover:underline">
              Ver cronograma
            </Link>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-neutral-400">
              {WEEKDAY_LABELS[todayWeekday]}, {formatBrDate(todayISO)} · conforme o cronograma de produção
            </p>
            {!isWorkday ? (
              <p className="text-sm text-neutral-500">O cronograma da fábrica vai de segunda a sexta. Hoje não há produção programada.</p>
            ) : isHoliday ? (
              <p className="text-sm text-neutral-500">Hoje está marcado como feriado no cronograma.</p>
            ) : todayProduction.length === 0 ? (
              <p className="text-sm text-neutral-500">Nada programado para hoje no cronograma.</p>
            ) : (
              <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {todayProduction.map((section) => (
                  <div key={section.label}>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                      {section.label}
                    </p>
                    <ul className="space-y-1.5">
                      {section.rows.map(({ cell, item }) => (
                        <li key={cell.item_id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate font-medium text-neutral-900">{item.name}</span>
                          <span
                            className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold uppercase ${CHIP[labelTone(cell.label)]}`}
                          >
                            {cell.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="justify-between">
            <div className="flex items-center gap-3">
              <CardIcon tone="violet">
                <Wheat className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </CardIcon>
              <CardTitle>Pão carioca</CardTitle>
            </div>
            <Link href="/estoque" className="text-xs font-semibold text-orange-600 hover:underline">
              Ver contagem
            </Link>
          </CardHeader>
          <CardContent>
            {!carioca || !cariocaCount || !cariocaCoverage ? (
              <p className="text-sm text-neutral-500">Ainda não há contagem do pão carioca.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-extrabold text-neutral-900">
                      {new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(Number(cariocaCount.boxes))}
                      <span className="ml-1.5 text-base font-semibold text-neutral-500">
                        {Number(cariocaCount.boxes) === 1 ? "caixa" : "caixas"}
                      </span>
                    </p>
                    <p className="text-xs text-neutral-400">
                      {formatQuantity(Number(cariocaCount.stock_units), carioca.unit)} de mín.{" "}
                      {formatQuantity(Number(carioca.min_quantity), carioca.unit)}
                    </p>
                  </div>
                  <p className="text-xs text-neutral-400">Contado em {formatBrDate(cariocaCount.count_date)}</p>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    Abastecimento
                  </p>
                  <CoverageBar ratio={cariocaCoverage.ratio} level={cariocaCoverage.level} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardIcon tone="blue">
              <CalendarDays className="h-[18px] w-[18px]" strokeWidth={2.25} />
            </CardIcon>
            <CardTitle>Próximos feriados</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {holidays.map((h) => (
                <li key={h.date} className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-neutral-50 leading-tight">
                    <span className="text-[10px] font-medium uppercase text-orange-600">
                      {MONTH_ABBR[Number(h.date.slice(5, 7)) - 1]}
                    </span>
                    <span className="text-lg font-extrabold text-orange-600">{Number(h.date.slice(8))}</span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900">{h.name}</p>
                    <p className="text-xs text-neutral-400">
                      {WEEKDAY_LABELS[weekdayOfISODate(h.date)]}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
