// Print what the app would show for a catalog, using the exact same query code.
// Compare these numbers with Lightroom (Library → All Photographs, filter bar
// → Metadata → Camera / Lens / Capture Date) to validate against a real catalog.
//
//   npm run inspect -- ~/Pictures/Lightroom/Lightroom\ Catalog.lrcat [--from 2024-01] [--to 2025-12]
//
// Read-only: the file is loaded into memory and never written. Close Lightroom
// first so recent edits are checkpointed out of the .lrcat-wal file.
import { readFileSync, statSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { fromSqlJs } from '../src/catalog/db.ts';
import { assertLightroom, checkHeader } from '../src/catalog/validate.ts';
import {
  getIsoHistogram,
  getSummary,
  getTimeline,
  getTopCameras,
  getTopLenses,
} from '../src/catalog/queries.ts';
import { isMonth, type MonthRange } from '../src/catalog/transforms.ts';

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i > 0 ? (process.argv[i + 1] ?? null) : null;
}

const path = process.argv
  .slice(2)
  .find((a, i, all) => !a.startsWith('--') && !all[i - 1]?.startsWith('--'));
if (!path) {
  console.error('Usage: npm run inspect -- <catalog.lrcat> [--from YYYY-MM] [--to YYYY-MM]');
  process.exit(2);
}
const from = arg('--from');
const to = arg('--to');
for (const m of [from, to]) {
  if (m && !isMonth(m)) {
    console.error(`Invalid month "${m}", expected YYYY-MM`);
    process.exit(2);
  }
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const t0 = performance.now();
const bytes = new Uint8Array(readFileSync(path));
const { wal } = checkHeader(bytes);
const SQL = await initSqlJs({ useOldExtensionFunctions: false });
const raw = new SQL.Database(bytes);
const db = fromSqlJs(raw);
assertLightroom(db);
const opened = performance.now();

const s = getSummary(db);
console.log(`\n${path}`);
console.log(`  size ${mb(statSync(path).size)}, ${wal ? 'WAL' : 'rollback-journal'} mode`);
console.log(
  `  opened in ${(opened - t0).toFixed(0)} ms, process memory ${mb(process.memoryUsage().rss)} (RSS)\n`
);
console.table(s);

const range: MonthRange = { from: from ?? s.firstMonth, to: to ?? s.lastMonth };
console.log(`Range: ${range.from ?? '…'} → ${range.to ?? '…'}`);

if (range.from && range.to) {
  const tl = getTimeline(db, { from: range.from, to: range.to });
  console.log(
    `\nPhotos per month (${tl.length} months, total ${tl.reduce((n, r) => n + r.count, 0)}):`
  );
  console.table(Object.fromEntries(tl.map((r) => [r.month, r.count])));
}
console.log('\nTop cameras:');
console.table(getTopCameras(db, range));
console.log('\nTop lenses:');
console.table(getTopLenses(db, range));
const iso = getIsoHistogram(db, range);
console.log('\nISO:');
console.table(
  Object.fromEntries([...iso.bins.map((b) => [b.label, b.count]), ['unknown', iso.unknown]])
);
console.log(`\nQueries ran in ${(performance.now() - opened).toFixed(0)} ms`);
raw.close();
