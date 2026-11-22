import * as Comlink from 'comlink';
import type { OpenStage, WorkerAPI } from '@/worker/db.worker';
import type { Param } from '@/catalog/db.ts';

let proxy: Comlink.Remote<WorkerAPI> | null = null;

/** The catalog worker, created on first use and kept for the page's lifetime. */
export function catalog(): Comlink.Remote<WorkerAPI> {
  if (!proxy) {
    const worker = new Worker(new URL('../worker/db.worker.ts', import.meta.url), {
      type: 'module',
      name: 'catalog-worker',
    });
    proxy = Comlink.wrap<WorkerAPI>(worker);
  }
  return proxy;
}

/**
 * Open a catalog. The File handle is structured-cloned (cheap; no bytes are
 * copied on the main thread) and read inside the worker.
 */
export function openCatalog(file: File, onStage?: (stage: OpenStage) => void) {
  // Callbacks must be wrapped to cross the worker boundary.
  return catalog().open(file, onStage ? Comlink.proxy(onStage) : undefined);
}

/** Open the built-in sample catalog (generated in the worker, works offline). */
export function openDemoCatalog() {
  return catalog().openDemo();
}

/** Raw SQL, for the dev-only debug page. */
export function query<T = Record<string, unknown>>(sql: string, params?: Param[]) {
  return catalog().query(sql, params) as Promise<T[]>;
}
