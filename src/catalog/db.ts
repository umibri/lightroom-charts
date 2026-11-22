// Engine-agnostic access to an open catalog. Query modules only see `Db`, so they
// run unchanged in the browser worker, in Vitest (Node), and in the inspect CLI.
// Relative imports with .ts extensions keep this folder runnable by plain Node.
import type { Database } from 'sql.js';

export type Row = Record<string, unknown>;
export type Param = string | number | null;

export interface Db {
  all<T = Row>(sql: string, params?: Param[]): T[];
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
