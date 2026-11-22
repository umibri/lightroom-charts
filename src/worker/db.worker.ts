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
  getVideoCount,
  type Summary,
} from '@/catalog/queries.ts';
import type { Month, MonthRange } from '@/catalog/transforms.ts';
import { buildCatalog, demoPhotos } from '@/catalog/fixtures.ts';
import { detectExifLink, diagnose, type Health } from '@/catalog/diagnose.ts';

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
  /** Built-in sample data, not the user's catalog. */
  demo: boolean;
  summary: Summary;
  /** Join/date sanity checks; the Stats page warns when they look wrong. */
  health: Health;
}

/** Errors crossing the worker boundary lose their class; send a plain shape instead. */
export type OpenError = { code: CatalogError['code']; message: string };
export type OpenOutcome = { ok: true; value: OpenResult } | { ok: false; error: OpenError };

/** Progress reported while opening, for the Load page. */
export type OpenStage = 'reading' | 'opening' | 'checking';

function fail(e: unknown): OpenOutcome {
  close();
  if (e instanceof CatalogError) return { ok: false, error: { code: e.code, message: e.message } };
  const err = e as Error;
  // Allocation failures surface as RangeError ("Array buffer allocation failed").
  const code = err?.name === 'RangeError' ? 'too-large' : 'open-failed';
  return { ok: false, error: { code, message: err?.message ?? String(e) } };
}

function openBytes(SQL: SqlJsStatic, bytes: Uint8Array) {
  try {
    raw = new SQL.Database(bytes);
  } catch (e) {
    if ((e as Error)?.name === 'RangeError') throw e;
    throw new CatalogError('open-failed', (e as Error).message);
  }
  db = fromSqlJs(raw);
}

/** Pick the EXIF join that matches this catalog, then measure data quality. */
function prepare(): Health {
  const link = detectExifLink(db!);
  db!.exifLink = link;
  return diagnose(db!, link);
}

const api = {
  /**
   * Open a catalog from the File handle itself. Reading happens here, off the
   * main thread, and the only full copy of the bytes is the one sql.js keeps.
   */
  async open(file: File, onStage?: (stage: OpenStage) => void): Promise<OpenOutcome> {
    close();
    try {
      onStage?.('reading');
      let buf: ArrayBuffer;
      try {
        buf = await file.arrayBuffer();
      } catch (e) {
        if ((e as Error)?.name === 'RangeError') throw e;
        throw new CatalogError('read-failed', (e as Error)?.message ?? 'Could not read the file');
      }
      const bytes = new Uint8Array(buf);
      const { wal } = checkHeader(bytes);
      onStage?.('opening');
      openBytes(await engine(), bytes);
      onStage?.('checking');
      assertLightroom(db!);
      const health = prepare();
      const summary = getSummary(db!);
      return {
        ok: true,
        value: { fileName: file.name, sizeBytes: file.size, wal, demo: false, summary, health },
      };
    } catch (e) {
      return fail(e);
    }
  },

  /** Open a generated sample catalog (no file, works offline). */
  async openDemo(): Promise<OpenOutcome> {
    close();
    try {
      const SQL = await engine();
      const now = new Date();
      const demo = buildCatalog(
        SQL,
        demoPhotos(3000, { year: now.getFullYear(), month: now.getMonth() + 1 })
      );
      const bytes = demo.export();
      demo.close();
      openBytes(SQL, bytes);
      const health = prepare();
      const summary = getSummary(db!);
      return {
        ok: true,
        value: {
          fileName: 'Demo catalog',
          sizeBytes: bytes.length,
          wal: false,
          demo: true,
          summary,
          health,
        },
      };
    } catch (e) {
      return fail(e);
    }
  },

  close,

  isOpen: () => db !== null,
  summary: () => getSummary(current()),
  timeline: (range: { from: Month; to: Month }) => getTimeline(current(), range),
  topCameras: (range: MonthRange | null, limit?: number) => getTopCameras(current(), range, limit),
  topLenses: (range: MonthRange | null, limit?: number) => getTopLenses(current(), range, limit),
  isoHistogram: (range: MonthRange | null) => getIsoHistogram(current(), range),
  videoCount: (range: MonthRange | null) => getVideoCount(current(), range),

  /** Raw SQL for the dev-only debug page. Not used by product code. */
  query: (sql: string, params: Param[] = []): Row[] => current().all(sql, params),
};

Comlink.expose(api);
export type WorkerAPI = typeof api;
