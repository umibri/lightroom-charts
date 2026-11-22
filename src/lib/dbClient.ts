import * as Comlink from 'comlink';
import type { WorkerAPI } from '@/worker/db.worker';

let proxy: Comlink.Remote<WorkerAPI> | null = null;

/** Lazily create and cache the worker proxy */
function getProxy(): Comlink.Remote<WorkerAPI> {
  if (!proxy) {
    const worker = new Worker(new URL('../worker/db.worker.ts', import.meta.url), {
      type: 'module',
      name: 'sqlite-worker',
    });
    proxy = Comlink.wrap<WorkerAPI>(worker);
  }
  return proxy;
}

/**
 * Initialize the database in the worker.
 * The ArrayBuffer is **transferred** to the worker (no copy on the hop), so
 * `bytes.buffer` is detached afterwards and must not be reused.
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
