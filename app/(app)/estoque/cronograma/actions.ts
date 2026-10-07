"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO } from "@/lib/dates";
import {
  addItemSchema,
  copyWeekSchema,
  itemIdSchema,
  moveItemSchema,
  renameItemSchema,
  saveNotesSchema,
  setCellSchema,
  toggleHolidaySchema,
} from "@/lib/validations/schedule";

export type ScheduleResult = { error?: string; ok?: boolean };

const PATH = "/estoque/cronograma";
const NO_ACCESS = "Você não tem permissão para editar o cronograma da fábrica.";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The week's row, created on first edit with the notes of the most recent earlier week carried over. */
async function ensureWeek(supabase: Supabase, weekStart: string) {
  const { data: existing } = await supabase.from("schedule_weeks").select("*").eq("week_start", weekStart).maybeSingle();
  if (existing) return existing;

  const { data: previous } = await supabase
    .from("schedule_weeks")
    .select("notes")
    .lt("week_start", weekStart)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: created } = await supabase
    .from("schedule_weeks")
    .insert({ week_start: weekStart, notes: previous?.notes ?? "", holidays: [] })
    .select("*")
    .single();
  return created;
}

/** Sets (or clears, when empty) the action planned for a product on a day. */
export async function setScheduleCell(input: unknown): Promise<ScheduleResult> {
  const { userId } = await requireUser();
  const parsed = setCellSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const { week_start, item_id, weekday, label } = parsed.data;

  const supabase = await createClient();
  const { error } = label
    ? await supabase
        .from("schedule_cells")
        .upsert({ week_start, item_id, weekday, label, updated_by: userId }, { onConflict: "week_start,item_id,weekday" })
    : await supabase.from("schedule_cells").delete().eq("week_start", week_start).eq("item_id", item_id).eq("weekday", weekday);
  if (error) return { error: NO_ACCESS };

  revalidatePath(PATH);
  return { ok: true };
}

export async function toggleScheduleHoliday(input: unknown): Promise<ScheduleResult> {
  await requireUser();
  const parsed = toggleHolidaySchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const { week_start, weekday } = parsed.data;

  const supabase = await createClient();
  const week = await ensureWeek(supabase, week_start);
  if (!week) return { error: NO_ACCESS };

  const holidays: number[] = week.holidays ?? [];
  const next = holidays.includes(weekday) ? holidays.filter((d) => d !== weekday) : [...holidays, weekday].sort();
  const { error } = await supabase
    .from("schedule_weeks")
    .update({ holidays: next, updated_at: new Date().toISOString() })
    .eq("week_start", week_start);
  if (error) return { error: NO_ACCESS };

  revalidatePath(PATH);
  return { ok: true };
}

export async function saveScheduleNotes(input: unknown): Promise<ScheduleResult> {
  await requireUser();
  const parsed = saveNotesSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };

  const supabase = await createClient();
  const week = await ensureWeek(supabase, parsed.data.week_start);
  if (!week) return { error: NO_ACCESS };
  const { error } = await supabase
    .from("schedule_weeks")
    .update({ notes: parsed.data.notes, updated_at: new Date().toISOString() })
    .eq("week_start", parsed.data.week_start);
  if (error) return { error: NO_ACCESS };

  revalidatePath(PATH);
  return { ok: true };
}

/** Copies last week's marks into an empty week (holidays are not copied: they are specific to a date). */
export async function copyPreviousScheduleWeek(input: unknown): Promise<ScheduleResult> {
  const { userId } = await requireUser();
  const parsed = copyWeekSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const { week_start } = parsed.data;

  const supabase = await createClient();
  const { count } = await supabase
    .from("schedule_cells")
    .select("item_id", { count: "exact", head: true })
    .eq("week_start", week_start);
  if ((count ?? 0) > 0) return { error: "Esta semana já tem marcações. Limpe-as antes de copiar a anterior." };

  const { data: previous } = await supabase
    .from("schedule_cells")
    .select("item_id, weekday, label")
    .eq("week_start", addDaysISO(week_start, -7));
  if (!previous?.length) return { error: "A semana anterior não tem marcações para copiar." };

  await ensureWeek(supabase, week_start);
  const { error } = await supabase
    .from("schedule_cells")
    .insert(previous.map((c) => ({ week_start, item_id: c.item_id, weekday: c.weekday, label: c.label, updated_by: userId })));
  if (error) return { error: NO_ACCESS };

  revalidatePath(PATH);
  return { ok: true };
}

export async function addScheduleItem(input: unknown): Promise<ScheduleResult> {
  await requireUser();
  const parsed = addItemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("schedule_items")
    .select("position")
    .eq("section", parsed.data.section)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("schedule_items")
    .insert({ section: parsed.data.section, name: parsed.data.name, position: (last?.position ?? 0) + 1 });
  if (error) return { error: NO_ACCESS };

  revalidatePath(PATH);
  return { ok: true };
}

export async function renameScheduleItem(input: unknown): Promise<ScheduleResult> {
  await requireUser();
  const parsed = renameItemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.from("schedule_items").update({ name: parsed.data.name }).eq("id", parsed.data.id);
  if (error) return { error: NO_ACCESS };

  revalidatePath(PATH);
  return { ok: true };
}

/** Hides the product from the grid (its marks in past weeks are kept). */
export async function removeScheduleItem(input: unknown): Promise<ScheduleResult> {
  await requireUser();
  const parsed = itemIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.from("schedule_items").update({ active: false }).eq("id", parsed.data.id);
  if (error) return { error: NO_ACCESS };

  revalidatePath(PATH);
  return { ok: true };
}

export async function moveScheduleItem(input: unknown): Promise<ScheduleResult> {
  await requireUser();
  const parsed = moveItemSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };

  const supabase = await createClient();
  const { data: item } = await supabase.from("schedule_items").select("id, section, position").eq("id", parsed.data.id).single();
  if (!item) return { error: "Produto não encontrado." };

  const { data: siblings } = await supabase
    .from("schedule_items")
    .select("id, position")
    .eq("section", item.section)
    .eq("active", true)
    .order("position");
  const list = siblings ?? [];
  const index = list.findIndex((s) => s.id === item.id);
  const neighbor = list[parsed.data.direction === "up" ? index - 1 : index + 1];
  if (index < 0 || !neighbor) return { ok: true };

  // swap the two positions (re-number to be safe if they ever tie)
  const reordered = [...list];
  [reordered[index], reordered[reordered.indexOf(neighbor)]] = [neighbor, reordered[index]];
  for (let i = 0; i < reordered.length; i++) {
    if (reordered[i].position !== i + 1) {
      const { error } = await supabase.from("schedule_items").update({ position: i + 1 }).eq("id", reordered[i].id);
      if (error) return { error: NO_ACCESS };
    }
  }

  revalidatePath(PATH);
  return { ok: true };
}
