// Print what the app would show for a catalog, using the exact same query code.
// Compare these numbers with Lightroom (Library → All Photographs, filter bar
// → Metadata → Camera / Lens / Capture Date) to validate against a real catalog.
//
//   npm run inspect -- ~/Pictures/Lightroom/Lightroom\ Catalog.lrcat [--from 2024-01] [--to 2025-12]
//
// Read-only: the file is loaded into memory and never written. Close Lightroom
// first so recent edits are checkpointed out of the .lrcat-wal file.
import { existsSync, readFileSync, statSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { fromSqlJs } from '../src/catalog/db.ts';
import { assertLightroom, checkHeader } from '../src/catalog/validate.ts';
import {
  getExposure,
  getIsoHistogram,
  getSummary,
  getTimeline,
  getTimeOfWeek,
  getTopCameras,
  getTopLenses,
  getVideoCount,
} from '../src/catalog/queries.ts';
import { HOURS, isMonth, WEEKDAYS, type MonthRange } from '../src/catalog/transforms.ts';
import { detectExifLink, diagnose, healthWarnings } from '../src/catalog/diagnose.ts';

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i > 0 ? (process.argv[i + 1] ?? null) : null;
}

// Tolerate a doubly quoted argument like "'/path/Catalog.lrcat'", which
// arrives with the inner quotes still attached.
const unquote = (a: string) => a.replace(/^(['"])(.*)\1$/, '$2');
const path = process.argv
  .slice(2)
  .find((a, i, all) => !a.startsWith('--') && !all[i - 1]?.startsWith('--'));
const file = path ? unquote(path) : undefined;
if (!file) {
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
if (!existsSync(file)) {
  console.error(`No file at: ${file}`);
  console.error(
    'Wrap the path in one pair of quotes, e.g. npm run inspect -- "/Users/me/Pictures/Lightroom/Catalog.lrcat"'
  );
  process.exit(2);
}
const bytes = new Uint8Array(readFileSync(file));
const { wal } = checkHeader(bytes);
const SQL = await initSqlJs({ useOldExtensionFunctions: false });
const raw = new SQL.Database(bytes);
const db = fromSqlJs(raw);
assertLightroom(db);
db.exifLink = detectExifLink(db);
const health = diagnose(db, db.exifLink);
const opened = performance.now();

const s = getSummary(db);
console.log(`\n${file}`);
console.log(`  size ${mb(statSync(file).size)}, ${wal ? 'WAL' : 'rollback-journal'} mode`);
console.log(
  `  opened in ${(opened - t0).toFixed(0)} ms, process memory ${mb(process.memoryUsage().rss)} (RSS)\n`
);
console.table(s);

const pct = (n: number) => (health.photos ? `${((n / health.photos) * 100).toFixed(1)}%` : '—');
console.log('Health (schema assumptions checked against this catalog):');
console.log(`  EXIF rows joined via Adobe_images.${health.exifLink}`);
console.log(`  photos with EXIF   ${health.withExif} / ${health.photos} (${pct(health.withExif)})`);
console.log(`  undated photos     ${health.undated} (${pct(health.undated)})`);
console.log(
  `  captureTime sample ${health.captureTimeSamples.map((t) => JSON.stringify(t)).join(', ') || '(none)'}`
);
const warnings = healthWarnings(health);
if (warnings.length) {
  console.log('\n  ⚠ Over half the photos look wrong; the app will show a warning.');
  console.log(
    '    Please share this Health block so the queries can be fixed. It has no file names or paths, only counts and three capture timestamps.'
  );
}
console.log('');

const range: MonthRange = { from: from ?? s.firstMonth, to: to ?? s.lastMonth };
console.log(`Range: ${range.from ?? '…'} → ${range.to ?? '…'}`);

if (range.from && range.to) {
  const tl = getTimeline(db, { from: range.from, to: range.to });
  console.log(
    `\nPhotos per month (${tl.length} months, total ${tl.reduce((n, r) => n + r.count, 0)}):`
  );
  console.table(Object.fromEntries(tl.map((r) => [r.month, r.count])));
}
console.log(
  `\nCamera, lens and ISO count stills only (${getVideoCount(db, range)} videos left out).`
);
console.log('\nTop cameras:');
console.table(getTopCameras(db, range));
console.log('\nTop lenses:');
console.table(getTopLenses(db, range));
const iso = getIsoHistogram(db, range);
console.log('\nISO:');
// An array keeps bin order; an object would sort numeric-looking keys first.
console.table([...iso.bins, { label: 'unknown', count: iso.unknown }]);
const ex = getExposure(db, range);
for (const [name, h] of [
  ['Aperture (nearest full stop)', ex.aperture],
  ['Shutter speed', ex.shutter],
  ['Focal length (mm as recorded)', ex.focal],
] as const) {
  console.log(`\n${name}:`);
  console.table([...h.bins, { label: 'unknown', count: h.unknown }]);
}
const tw = getTimeOfWeek(db, range);
console.log('\nPhotos by hour:');
console.table(tw.hours.map((count, h) => ({ hour: HOURS[h], count })));
console.log('\nPhotos by weekday:');
console.table(tw.weekdays.map((count, d) => ({ day: WEEKDAYS[d], count })));
console.log(`\nQueries ran in ${(performance.now() - opened).toFixed(0)} ms`);
raw.close();
