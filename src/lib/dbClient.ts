import * as Comlink from 'comlink';
import type { WorkerAPI } from '@/worker/db.worker';

let proxy: Comlink.Remote<WorkerAPI> | null = null;
let workerRef: Worker | null = null;

/** Lazily create and cache the worker proxy */
function getProxy(): Comlink.Remote<WorkerAPI> {
  if (!proxy) {
    workerRef = new Worker(new URL('@/worker/db.worker.ts', import.meta.url), {
      type: 'module',
      name: 'sqlite-worker',
    });
    proxy = Comlink.wrap<WorkerAPI>(workerRef);
  }
  return proxy;
}

/**
 * Initialize the database in the worker.
 * IMPORTANT: This **transfers** the ArrayBuffer for zero-copy.
 * After calling, `bytes.buffer` is detached and must not be reused.
 */
export async function initDatabase(bytes: Uint8Array) {
  const p = getProxy();
  return p.init(Comlink.transfer(bytes, [bytes.buffer]));
}

/** Run a SQL query through the worker. Call after initDatabase(). */
export async function query<T = Record<string, unknown>>(sql: string, params?: unknown[]) {
  const p = getProxy();
  return p.query(sql, params) as Promise<T[]>;
}

/** Optional cleanup (not required for MVP). */
export function disposeDatabase() {
  if (workerRef) {
    workerRef.terminate();
    workerRef = null;
  }
  proxy = null;
}
