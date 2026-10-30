"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";

export type Reminder = { id: string; text: string; done: boolean };
export type ReminderResult = { error?: string; reminder?: Reminder };

const NO_ACCESS = "Não foi possível salvar o lembrete. Tente novamente.";

const textSchema = z.string().trim().min(1, "Escreva o lembrete.").max(300, "No máximo 300 caracteres.");

/** Personal reminders: row-level security keeps each user to their own rows. */
export async function addReminder(text: string): Promise<ReminderResult> {
  const { userId } = await requireUser();
  const parsed = textSchema.safeParse(text);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Lembrete inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_reminders")
    .insert({ user_id: userId, text: parsed.data })
    .select("id, text, done")
    .single();
  if (error || !data) return { error: NO_ACCESS };
  return { reminder: data as Reminder };
}

/** Changes the text of an existing reminder (the done mark is kept). */
export async function editReminder(id: string, text: string): Promise<ReminderResult> {
  await requireUser();
  if (!z.string().uuid().safeParse(id).success) return { error: "Lembrete inválido." };
  const parsed = textSchema.safeParse(text);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Lembrete inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_reminders")
    .update({ text: parsed.data })
    .eq("id", id)
    .select("id, text, done")
    .single();
  if (error || !data) return { error: NO_ACCESS };
  return { reminder: data as Reminder };
}

export async function setReminderDone(id: string, done: boolean): Promise<ReminderResult> {
  await requireUser();
  if (!z.string().uuid().safeParse(id).success) return { error: "Lembrete inválido." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_reminders")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  return error ? { error: NO_ACCESS } : {};
}

export async function deleteReminder(id: string): Promise<ReminderResult> {
  await requireUser();
  if (!z.string().uuid().safeParse(id).success) return { error: "Lembrete inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("user_reminders").delete().eq("id", id);
  return error ? { error: NO_ACCESS } : {};
}

export async function clearDoneReminders(): Promise<ReminderResult> {
  const { userId } = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("user_reminders").delete().eq("user_id", userId).eq("done", true);
  return error ? { error: NO_ACCESS } : {};
}
