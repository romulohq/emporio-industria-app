"use client";

import { useMemo, useSyncExternalStore } from "react";

/** Highlighter colours offered on the count screen. */
export const HIGHLIGHT_COLORS = [
  { value: "#fde047", label: "Amarelo" },
  { value: "#86efac", label: "Verde" },
  { value: "#f9a8d4", label: "Rosa" },
  { value: "#93c5fd", label: "Azul" },
  { value: "#fdba74", label: "Laranja" },
] as const;

// v2: marks belong to one count date ("2026-10-15:<product id>" -> colour). The first version
// kept one mark per product for every day, which is not what the count needs, so it is not read.
const KEY = "stock-highlights-v2";
const EMPTY: Record<string, string> = {};

// kept in this browser so the marks survive reloads
let cache: Record<string, string> | null = null;
const listeners = new Set<() => void>();

function read(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (parsed && typeof parsed === "object") {
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).filter(([, v]) => typeof v === "string")
      ) as Record<string, string>;
    }
  } catch {
    // storage blocked or corrupted: start without marks
  }
  return {};
}

function snapshot(): Record<string, string> {
  if (cache === null) cache = read();
  return cache;
}

function commit(next: Record<string, string>) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // the marks still work for this page session
  }
  listeners.forEach((listener) => listener());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      callback();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

/** Marks a product, on one count date, with a colour (null removes the mark). */
export function setHighlight(date: string, productId: string, color: string | null) {
  const next = { ...snapshot() };
  const key = `${date}:${productId}`;
  if (color === null) delete next[key];
  else next[key] = color;
  commit(next);
}

/** Removes every mark of one count date. */
export function clearHighlights(date: string) {
  const prefix = `${date}:`;
  commit(Object.fromEntries(Object.entries(snapshot()).filter(([key]) => !key.startsWith(prefix))));
}

/** The marks of one count date: product id -> colour. */
export function useHighlights(date: string): Record<string, string> {
  const all = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  return useMemo(() => {
    const prefix = `${date}:`;
    return Object.fromEntries(
      Object.entries(all)
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, color]) => [key.slice(prefix.length), color])
    );
  }, [all, date]);
}
