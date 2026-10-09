"use client";

import { useSyncExternalStore } from "react";

// Kept in memory on purpose: client-side navigation (tabs, menu) keeps the value, while reloading
// the page starts a fresh JavaScript session and drops it — which is exactly how the pin behaves.
let pinned: string | null = null;
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function getPinnedDate(): string | null {
  return pinned;
}

export function setPinnedDate(date: string | null) {
  pinned = date;
  listeners.forEach((listener) => listener());
}

/** The date pinned in this page session, or null. */
export function usePinnedDate(): string | null {
  return useSyncExternalStore(subscribe, () => pinned, () => null);
}
