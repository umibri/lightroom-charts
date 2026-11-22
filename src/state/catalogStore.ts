import { useSyncExternalStore } from 'react';
import type { OpenResult } from '@/worker/db.worker';

// Which catalog is open in the worker. Lives for the page's lifetime: a reload
// starts a fresh worker with nothing open, and this store starts empty too.
export interface OpenCatalog extends OpenResult {
  /** Bumped on every successful open; part of every query key. */
  generation: number;
}

let current: OpenCatalog | null = null;
let generation = 0;
const listeners = new Set<() => void>();

export function getOpenCatalog(): OpenCatalog | null {
  return current;
}

export function setOpenCatalog(result: OpenResult | null) {
  current = result ? { ...result, generation: ++generation } : null;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useOpenCatalog(): OpenCatalog | null {
  return useSyncExternalStore(subscribe, getOpenCatalog, getOpenCatalog);
}
