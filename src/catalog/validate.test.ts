import { beforeAll, describe, expect, it } from 'vitest';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { fromSqlJs } from './db.ts';
import { buildCatalog } from './fixtures.ts';
import { assertLightroom, CatalogError, checkHeader, missingSchema } from './validate.ts';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await initSqlJs({ useOldExtensionFunctions: false });
});

describe('checkHeader', () => {
  it('accepts a SQLite file and reports rollback-journal mode', () => {
    const bytes = buildCatalog(SQL, []).export();
    expect(checkHeader(bytes)).toEqual({ wal: false });
  });

  it('reports WAL mode from header bytes 18/19', () => {
    const bytes = buildCatalog(SQL, []).export();
    bytes[18] = 2;
    bytes[19] = 2;
    expect(checkHeader(bytes)).toEqual({ wal: true });
  });

  it('rejects non-SQLite bytes with a not-sqlite code', () => {
    const text = new TextEncoder().encode('hello'.repeat(40));
    expect(() => checkHeader(text)).toThrow(CatalogError);
    try {
      checkHeader(text);
    } catch (e) {
      expect((e as CatalogError).code).toBe('not-sqlite');
    }
  });

  it('rejects files shorter than the header', () => {
    expect(() => checkHeader(new Uint8Array(10))).toThrow(/too small/);
  });
});

describe('Lightroom schema check', () => {
  it('passes for a Lightroom-shaped catalog', () => {
    const db = fromSqlJs(buildCatalog(SQL, [{ captureTime: '2025-01-01T00:00:00' }]));
    expect(missingSchema(db)).toEqual([]);
    expect(() => assertLightroom(db)).not.toThrow();
  });

  it('names missing tables and columns for other SQLite files', () => {
    const raw = new SQL.Database();
    raw.run(`CREATE TABLE Adobe_images (id_local INTEGER PRIMARY KEY, captureTime TEXT)`);
    const db = fromSqlJs(raw);
    const missing = missingSchema(db);
    expect(missing).toContain('Adobe_images.masterImage');
    expect(missing).toContain('AgHarvestedExifMetadata');
    expect(() => assertLightroom(db)).toThrow(/Not a Lightroom Classic catalog/);
  });
});
