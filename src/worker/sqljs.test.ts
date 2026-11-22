import { describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';

// Harness check: the same sql.js build the worker uses runs under Vitest/Node, so
// catalog query modules (Phase 1) can be unit-tested against fixture databases
// without a browser or worker.
describe('sql.js in Node', () => {
  it('opens a database from bytes and queries it', async () => {
    const SQL = await initSqlJs({ useOldExtensionFunctions: false });

    const src = new SQL.Database();
    src.run('CREATE TABLE Adobe_images (id_local INTEGER PRIMARY KEY, captureTime TEXT)');
    src.run('INSERT INTO Adobe_images VALUES (1, ?), (2, ?)', [
      '2025-03-01T10:00:00',
      '2025-04-02T11:30:00.123',
    ]);
    const bytes = src.export();
    src.close();

    // Real SQLite files start with this 16-byte magic string.
    expect(new TextDecoder().decode(bytes.subarray(0, 16))).toBe('SQLite format 3\0');

    const db = new SQL.Database(bytes);
    const res = db.exec(
      'SELECT substr(captureTime, 1, 7) AS month, COUNT(*) AS n FROM Adobe_images GROUP BY 1 ORDER BY 1'
    );
    db.close();

    expect(res[0].values).toEqual([
      ['2025-03', 1],
      ['2025-04', 1],
    ]);
  });
});
