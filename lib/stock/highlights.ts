"use client";

import { useSyncExternalStore } from "react";

/** Highlighter colours offered on the count screen. */
export const HIGHLIGHT_COLORS = [
  { value: "#fde047", label: "Amarelo" },
  { value: "#86efac", label: "Verde" },
  { value: "#f9a8d4", label: "Rosa" },
  { value: "#93c5fd", label: "Azul" },
  { value: "#fdba74", label: "Laranja" },
] as const;

const KEY = "stock-highlights-v1";
const EMPTY: Record<string, string> = {};

// product id -> colour, kept in this browser so the marks survive reloads
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

/** Marks a product with a colour (null removes the mark). */
export function setHighlight(productId: string, color: string | null) {
  const next = { ...snapshot() };
  if (color === null) delete next[productId];
  else next[productId] = color;
  commit(next);
}

export function clearHighlights() {
  commit({});
}

export function useHighlights(): Record<string, string> {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
