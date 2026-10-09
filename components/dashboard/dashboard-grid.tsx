"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { GripVertical } from "lucide-react";

export type DashboardCard = { id: string; node: React.ReactNode };

const STORAGE_KEY = "dashboard-card-order-v1";
// the grid is built of 8px rows; each card spans as many as its content needs (plus the gap)
const ROW = 8;
const GAP = 16;

// the saved order lives in localStorage; reading it through useSyncExternalStore keeps the server
// render (default order) and the first client render identical, then switches to the saved one
const listeners = new Set<() => void>();
function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}
function readSaved(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
function writeSaved(order: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    // storage blocked: the order simply is not remembered
  }
  listeners.forEach((l) => l());
}

/** Merges a saved order with the current cards: unknown ids are dropped, new cards go last. */
function mergeOrder(saved: unknown, ids: string[]): string[] {
  const known = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string" && ids.includes(id)) : [];
  return [...known, ...ids.filter((id) => !known.includes(id))];
}

function MasonryItem({
  id,
  dragging,
  over,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  children,
}: {
  id: string;
  dragging: boolean;
  over: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  children: React.ReactNode;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [span, setSpan] = useState(30);

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const update = () => setSpan(Math.max(1, Math.ceil((el.offsetHeight + GAP) / ROW)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={outer}
      data-card={id}
      style={{ gridRowEnd: `span ${span}` }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`transition-opacity ${dragging ? "opacity-40" : ""}`}
    >
      <div
        ref={inner}
        className={`relative rounded-2xl ${over ? "ring-2 ring-orange-400 ring-offset-2" : ""}`}
      >
        {children}
        <button
          type="button"
          draggable
          aria-label="Mover card"
          title="Arraste para mudar de lugar"
          onDragStart={(e) => {
            if (outer.current) e.dataTransfer.setDragImage(outer.current, 24, 24);
            onDragStart(e);
          }}
          onDragEnd={onDragEnd}
          className="absolute left-1 top-7 cursor-grab rounded p-0.5 text-neutral-300 hover:bg-neutral-100 hover:text-neutral-500 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Dashboard cards that pack themselves by height (a card with more content grows and the
 * others fill in around it) and can be reordered by dragging the grip on each card. The order
 * is remembered in this browser.
 */
export function DashboardGrid({ cards }: { cards: DashboardCard[] }) {
  const ids = cards.map((c) => c.id);
  const savedRaw = useSyncExternalStore(subscribe, readSaved, () => null);
  // set when storage is blocked, so reordering still works for this visit
  const [override, setOverride] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  let saved: unknown = null;
  try {
    saved = savedRaw ? JSON.parse(savedRaw) : null;
  } catch {
    saved = null;
  }
  const order = override ?? mergeOrder(saved, ids);

  function drop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const next = order.filter((id) => id !== dragId);
    const targetIndex = next.indexOf(targetId);
    // dragging down lands after the target, dragging up lands before it
    const movingDown = order.indexOf(dragId) < order.indexOf(targetId);
    next.splice(movingDown ? targetIndex + 1 : targetIndex, 0, dragId);
    setOverride(next);
    writeSaved(next);
  }

  const byId = new Map(cards.map((c) => [c.id, c]));
  const ordered = order.map((id) => byId.get(id)!).filter(Boolean);

  return (
    <div
      className="grid grid-cols-1 gap-x-4 lg:grid-cols-2 min-[1400px]:grid-cols-3"
      style={{ gridAutoRows: `${ROW}px` }}
    >
      {ordered.map((card) => (
        <MasonryItem
          key={card.id}
          id={card.id}
          dragging={dragId === card.id}
          over={overId === card.id && dragId !== null && dragId !== card.id}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", card.id);
            setDragId(card.id);
          }}
          onDragEnd={() => {
            setDragId(null);
            setOverId(null);
          }}
          onDragOver={(e) => {
            if (!dragId) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (overId !== card.id) setOverId(card.id);
          }}
          onDrop={(e) => {
            e.preventDefault();
            drop(card.id);
            setDragId(null);
            setOverId(null);
          }}
        >
          {card.node}
        </MasonryItem>
      ))}
    </div>
  );
}
