// Write the fixture catalogs the browser tests upload, plus the numbers the UI
// should show for them (computed with the same query code the worker runs).
import { mkdirSync, writeFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { buildCatalog, demoPhotos } from '../src/catalog/fixtures.ts';
import { fromSqlJs } from '../src/catalog/db.ts';
import { getSummary, getTimeline } from '../src/catalog/queries.ts';
import { monthOf, presetRange } from '../src/catalog/transforms.ts';
import { FIXTURES, type Expected } from './paths.ts';

export default async function globalSetup() {
  mkdirSync(FIXTURES.dir, { recursive: true });
  const SQL = await initSqlJs({ useOldExtensionFunctions: false });
  const now = new Date();
  const raw = buildCatalog(
    SQL,
    demoPhotos(3000, { year: now.getFullYear(), month: now.getMonth() + 1 })
  );
  writeFileSync(FIXTURES.demo, raw.export());

  const db = fromSqlJs(raw);
  const s = getSummary(db);
  const today = monthOf(now);
  const total = (r: { from: string; to: string } | null) =>
    r ? getTimeline(db, r).reduce((n, x) => n + x.count, 0) : 0;
  const expected: Expected = {
    photos: s.photos,
    m12: total(presetRange('12m', today, null)),
    m24: total(presetRange('24m', today, null)),
    all: total({ from: s.firstMonth!, to: s.lastMonth! }),
  };
  writeFileSync(FIXTURES.expected, JSON.stringify(expected));
  raw.close();

  writeFileSync(FIXTURES.notDb, 'definitely not a database '.repeat(20));
  const other = new SQL.Database();
  other.run('CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT)');
  writeFileSync(FIXTURES.otherDb, other.export());
  other.close();
}
