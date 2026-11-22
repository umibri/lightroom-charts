// Write a synthetic Lightroom-shaped catalog to disk, for trying the app
// without a real catalog and for browser checks.
//
//   npm run fixture -- scratch/demo.lrcat [photoCount=3000]
import { writeFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { buildCatalog, demoPhotos } from '../src/catalog/fixtures.ts';

const [out, countArg] = process.argv.slice(2);
if (!out) {
  console.error('Usage: npm run fixture -- <out.lrcat> [photoCount]');
  process.exit(2);
}
const count = Number(countArg ?? 3000);
const now = new Date();
const SQL = await initSqlJs({ useOldExtensionFunctions: false });
const db = buildCatalog(
  SQL,
  demoPhotos(count, { year: now.getFullYear(), month: now.getMonth() + 1 })
);
writeFileSync(out, db.export());
db.close();
console.log(`Wrote ${count} photos to ${out}`);
