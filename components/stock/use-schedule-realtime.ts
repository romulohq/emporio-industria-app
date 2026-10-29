"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { colorFor, otherCollaborators, type Collaborator } from "@/lib/schedule/presence";
import type { ScheduleCell, ScheduleWeek } from "@/lib/types/database.types";

type Handlers = {
  /** label null = a marcação foi limpa */
  onCell: (itemId: string, weekday: number, label: string | null) => void;
  onWeek: (week: { holidays: number[]; notes: string }) => void;
  onItemsChanged: () => void;
};

type Me = { id: string; name: string };

/**
 * Cronograma ao vivo: recebe as mudanças que os outros fazem (marcações, feriados, observações, lista de
 * produtos) e diz quem está com a semana aberta e em qual célula (como no Google Planilhas).
 */
export function useScheduleRealtime(weekStart: string, me: Me, handlers: Handlers) {
  const [others, setOthers] = useState<Collaborator[]>([]);
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const stateRef = useRef<Collaborator>({ userId: me.id, name: me.name, color: colorFor(me.id), cell: null, notes: false });
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const subscribedRef = useRef(false);

  const publish = useCallback(() => {
    if (channelRef.current && subscribedRef.current) void channelRef.current.track(stateRef.current);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const tabKey = crypto.randomUUID();
    const channel = supabase.channel(`cronograma:${weekStart}`, { config: { presence: { key: tabKey } } });
    channelRef.current = channel;

    channel
      .on<ScheduleCell>("postgres_changes", { event: "*", schema: "public", table: "schedule_cells", filter: `week_start=eq.${weekStart}` }, (payload) => {
        if (payload.eventType === "DELETE") {
          const old = payload.old as Partial<ScheduleCell>;
          if (old.item_id != null && old.weekday != null) handlersRef.current.onCell(old.item_id, old.weekday, null);
        } else {
          const row = payload.new;
          handlersRef.current.onCell(row.item_id, row.weekday, row.label);
        }
      })
      .on<ScheduleWeek>("postgres_changes", { event: "*", schema: "public", table: "schedule_weeks", filter: `week_start=eq.${weekStart}` }, (payload) => {
        if (payload.eventType === "DELETE") return;
        handlersRef.current.onWeek({ holidays: payload.new.holidays ?? [], notes: payload.new.notes ?? "" });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule_items" }, () => handlersRef.current.onItemsChanged())
      .on("presence", { event: "sync" }, () => {
        const all = Object.values(channel.presenceState<Collaborator>()).flat();
        setOthers(otherCollaborators(all, me.id));
      })
      .subscribe((status) => {
        subscribedRef.current = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED") void channel.track(stateRef.current);
      });

    // a célula selecionada some da tela dos outros quando a aba fica em segundo plano
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && stateRef.current.cell) {
        stateRef.current = { ...stateRef.current, cell: null };
        publish();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      subscribedRef.current = false;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [weekStart, me.id, publish]);

  const select = useCallback(
    (cell: string | null) => {
      if (stateRef.current.cell === cell) return;
      stateRef.current = { ...stateRef.current, cell };
      publish();
    },
    [publish]
  );

  const setTypingNotes = useCallback(
    (notes: boolean) => {
      if (stateRef.current.notes === notes) return;
      stateRef.current = { ...stateRef.current, notes };
      publish();
    },
    [publish]
  );

  return { others, select, setTypingNotes };
}
