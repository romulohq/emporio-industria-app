"use client";

import { useState, useTransition } from "react";
import { Check, ListChecks, Plus, X } from "lucide-react";
import {
  addReminder,
  clearDoneReminders,
  deleteReminder,
  setReminderDone,
  type Reminder,
} from "@/app/(app)/dashboard/reminders-actions";
import { Card, CardContent, CardHeader, CardIcon, CardTitle } from "@/components/ui/card";

const VISIBLE = 6;

/** Personal checklist of the signed-in user: add with Enter, tick, delete, clear what is done. */
export function RemindersCard({ initial }: { initial: Reminder[] }) {
  const [items, setItems] = useState<Reminder[]>(initial);
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // open ones first, done ones at the bottom; each group keeps the order they were written in
  const ordered = [...items.filter((i) => !i.done), ...items.filter((i) => i.done)];
  const shown = expanded ? ordered : ordered.slice(0, VISIBLE);
  const doneCount = items.filter((i) => i.done).length;
  const openCount = items.length - doneCount;

  function add(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setError(null);
    startTransition(async () => {
      const result = await addReminder(value);
      if (result.error || !result.reminder) {
        setError(result.error ?? "Não foi possível salvar.");
        return;
      }
      setItems((prev) => [...prev, result.reminder as Reminder]);
      setText("");
    });
  }

  function toggle(item: Reminder) {
    setError(null);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
    startTransition(async () => {
      const result = await setReminderDone(item.id, !item.done);
      if (result.error) {
        setError(result.error);
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: item.done } : i)));
      }
    });
  }

  function remove(item: Reminder) {
    setError(null);
    const before = items;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    startTransition(async () => {
      const result = await deleteReminder(item.id);
      if (result.error) {
        setError(result.error);
        setItems(before);
      }
    });
  }

  function clearDone() {
    setError(null);
    const before = items;
    setItems((prev) => prev.filter((i) => !i.done));
    startTransition(async () => {
      const result = await clearDoneReminders();
      if (result.error) {
        setError(result.error);
        setItems(before);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="justify-between">
        <div className="flex items-center gap-3">
          <CardIcon tone="green">
            <ListChecks className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </CardIcon>
          <div>
            <CardTitle>Meus lembretes</CardTitle>
            <p className="text-[11px] text-neutral-400">Só você vê estas anotações</p>
          </div>
        </div>
        {openCount > 0 && (
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700">{openCount}</span>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={add} className="relative mb-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escreva um lembrete e aperte Enter"
            maxLength={300}
            aria-label="Novo lembrete"
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2 pl-3 pr-10 text-base placeholder:text-neutral-400 focus:border-orange-500 focus:bg-white focus:outline-none sm:text-sm"
          />
          <button
            type="submit"
            disabled={pending || text.trim() === ""}
            aria-label="Adicionar lembrete"
            className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-400 hover:bg-orange-50 hover:text-orange-600 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </form>

        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

        {items.length === 0 ? (
          <p className="text-sm text-neutral-400">Nada anotado por aqui ainda.</p>
        ) : (
          <ul className="space-y-0.5">
            {shown.map((item) => (
              <li key={item.id} className="group flex items-start gap-2.5 rounded-lg px-1 py-1.5 hover:bg-neutral-50">
                <button
                  type="button"
                  onClick={() => toggle(item)}
                  role="checkbox"
                  aria-checked={item.done}
                  aria-label={item.done ? "Desmarcar lembrete" : "Marcar lembrete como feito"}
                  className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors ${
                    item.done ? "border-green-500 bg-green-500 text-white" : "border-neutral-300 bg-white hover:border-green-500"
                  }`}
                >
                  {item.done && <Check className="h-3 w-3" strokeWidth={3} />}
                </button>
                <span
                  className={`min-w-0 flex-1 whitespace-pre-line break-words text-sm leading-snug ${
                    item.done ? "text-neutral-400 line-through" : "text-neutral-800"
                  }`}
                >
                  {item.text}
                </span>
                <button
                  type="button"
                  onClick={() => remove(item)}
                  aria-label="Excluir lembrete"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-300 opacity-0 hover:text-red-500 focus:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {(ordered.length > VISIBLE || doneCount > 0) && (
          <div className="mt-3 flex items-center justify-between text-xs">
            {ordered.length > VISIBLE ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="font-semibold text-orange-600 hover:underline"
              >
                {expanded ? "Mostrar menos" : `Ver todos (${ordered.length})`}
              </button>
            ) : (
              <span />
            )}
            {doneCount > 0 && (
              <button type="button" onClick={clearDone} className="font-medium text-neutral-400 hover:text-red-600 hover:underline">
                Limpar concluídos ({doneCount})
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
