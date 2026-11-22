// Engine-agnostic access to an open catalog. Query modules only see `Db`, so they
// run unchanged in the browser worker, in Vitest (Node), and in the inspect CLI.
// Relative imports with .ts extensions keep this folder runnable by plain Node.
import type { Database } from 'sql.js';

export type Row = Record<string, unknown>;
export type Param = string | number | null;

/** Which Adobe_images column AgHarvestedExifMetadata.image refers to. */
export type ExifLink = 'id_local' | 'rootFile';

export interface Db {
  all<T = Row>(sql: string, params?: Param[]): T[];
  /** Set after detection at open time; queries default to 'id_local'. */
  exifLink?: ExifLink;
}

/** Wrap a sql.js Database. */
export function fromSqlJs(db: Database): Db {
  return {
    all<T>(sql: string, params: Param[] = []) {
      const stmt = db.prepare(sql);
      try {
        stmt.bind(params);
        const rows: T[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject() as T);
        return rows;
      } finally {
        stmt.free();
      }
    },
  };
}
