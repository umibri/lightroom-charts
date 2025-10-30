/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
// Vite will fingerprint and serve this asset; no 404s in dev or build.
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

type Row = Record<string, unknown>;

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

async function ensureSql() {
  if (!SQL) {
    SQL = await initSqlJs({ locateFile: () => wasmUrl });
  }
}

const api = {
  /**
   * Initialize the DB from bytes. Pass a Uint8Array and we'll take ownership
   * via Transferable (ArrayBuffer), avoiding a copy.
   */
  async init(dbBytes: Uint8Array): Promise<{ ok: 1 }> {
    await ensureSql();
    // Close any prior DB (MVP is single open)
    if (db) {
      try {
        db.close();
      } catch {
        /* empty */
      }
      db = null;
    }
    db = new SQL!.Database(dbBytes);
    // Smoke test
    const res = api.query('SELECT 1 AS ok') as Array<Row>;
    const first = res[0] as { ok: number };
    if (!first || first.ok !== 1) throw new Error('DB init smoke test failed');
    return { ok: 1 };
  },

  /**
   * Run a SQL query with optional positional params.
   */
  query(sql: string, params: unknown[] = []): Array<Row> {
    if (!db) throw new Error('DB not initialized');
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params as never);
      const rows: Array<Row> = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as Row);
      }
      return rows;
    } finally {
      stmt.free();
    }
  },
};

Comlink.expose(api);
export type WorkerAPI = typeof api;
