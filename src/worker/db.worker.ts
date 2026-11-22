/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
// Vite fingerprints and serves this asset in dev and build.
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { fromSqlJs, type Db, type Param, type Row } from '@/catalog/db.ts';
import { assertLightroom, CatalogError, checkHeader } from '@/catalog/validate.ts';
import {
  getIsoHistogram,
  getSummary,
  getTimeline,
  getTopCameras,
  getTopLenses,
  type Summary,
} from '@/catalog/queries.ts';
import type { Month, MonthRange } from '@/catalog/transforms.ts';

let SQL: SqlJsStatic | null = null;
let raw: Database | null = null;
let db: Db | null = null;

async function engine(): Promise<SqlJsStatic> {
  SQL ??= await initSqlJs({ locateFile: () => wasmUrl, useOldExtensionFunctions: false });
  return SQL;
}

function close() {
  try {
    raw?.close();
  } catch {
    /* already closed */
  }
  raw = null;
  db = null;
}

function current(): Db {
  if (!db) throw new CatalogError('open-failed', 'No catalog is open');
  return db;
}

export interface OpenResult {
  fileName: string;
  sizeBytes: number;
  wal: boolean;
  summary: Summary;
}

/** Errors crossing the worker boundary lose their class; send a plain shape instead. */
export type OpenError = { code: CatalogError['code']; message: string };

const api = {
  /**
   * Open a catalog from the File handle itself. Reading happens here, off the
   * main thread, and the only full copy of the bytes is the one sql.js keeps.
   */
  async open(
    file: File
  ): Promise<{ ok: true; value: OpenResult } | { ok: false; error: OpenError }> {
    close();
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { wal } = checkHeader(bytes);
      const SQL = await engine();
      try {
        raw = new SQL.Database(bytes);
      } catch (e) {
        throw new CatalogError('open-failed', (e as Error).message);
      }
      db = fromSqlJs(raw);
      assertLightroom(db);
      const summary = getSummary(db);
      return { ok: true, value: { fileName: file.name, sizeBytes: file.size, wal, summary } };
    } catch (e) {
      close();
      if (e instanceof CatalogError)
        return { ok: false, error: { code: e.code, message: e.message } };
      return {
        ok: false,
        error: { code: 'open-failed', message: (e as Error)?.message ?? String(e) },
      };
    }
  },

  close,

  isOpen: () => db !== null,
  summary: () => getSummary(current()),
  timeline: (range: { from: Month; to: Month }) => getTimeline(current(), range),
  topCameras: (range: MonthRange | null, limit?: number) => getTopCameras(current(), range, limit),
  topLenses: (range: MonthRange | null, limit?: number) => getTopLenses(current(), range, limit),
  isoHistogram: (range: MonthRange | null) => getIsoHistogram(current(), range),

  /** Raw SQL for the dev-only debug page. Not used by product code. */
  query: (sql: string, params: Param[] = []): Row[] => current().all(sql, params),
};

Comlink.expose(api);
export type WorkerAPI = typeof api;
