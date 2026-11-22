// Pure helpers, no SQL. Months are 'YYYY-MM' strings throughout: Lightroom's
// captureTime is local wall-clock time with no zone, so comparing month strings
// avoids every timezone conversion.

export type Month = string; // 'YYYY-MM'

/** Inclusive month range. `null` bounds mean open-ended. */
export interface MonthRange {
  from: Month | null;
  to: Month | null;
}

export interface MonthCount {
  month: Month;
  count: number;
}

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonth(s: string): boolean {
  return MONTH_RE.test(s);
}

function toIndex(m: Month): number {
  const match = MONTH_RE.exec(m);
  if (!match) throw new RangeError(`Invalid month: ${m}`);
  return Number(match[1]) * 12 + Number(match[2]) - 1;
}

function fromIndex(i: number): Month {
  const y = Math.floor(i / 12);
  const mo = (i % 12) + 1;
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}`;
}

export function addMonths(m: Month, n: number): Month {
  return fromIndex(toIndex(m) + n);
}

/** Local calendar month of a Date (matches how Lightroom stores capture time). */
export function monthOf(d: Date): Month {
  return fromIndex(d.getFullYear() * 12 + d.getMonth());
}

/** Every month from..to inclusive, oldest first. Empty if from > to. */
export function monthsBetween(from: Month, to: Month): Month[] {
  const out: Month[] = [];
  for (let i = toIndex(from); i <= toIndex(to); i++) out.push(fromIndex(i));
  return out;
}

/**
 * Fill gaps with zero counts so the timeline is continuous. Rows outside the
 * range are dropped. Duplicate months are summed.
 */
export function zeroFillMonths(rows: MonthCount[], from: Month, to: Month): MonthCount[] {
  const counts = new Map<Month, number>();
  for (const r of rows) counts.set(r.month, (counts.get(r.month) ?? 0) + r.count);
  return monthsBetween(from, to).map((month) => ({ month, count: counts.get(month) ?? 0 }));
}

export type Preset = '12m' | '24m' | 'all';

/**
 * Resolve a preset to a concrete range. 12/24 months are the last N months of
 * the catalog: they end at the current month, or at the latest photo's month
 * when the catalog stops earlier (otherwise an older catalog opens on an empty
 * chart). For 'all', `extent` is the catalog's first/last capture month; null
 * when the catalog has no dated photos.
 */
export function presetRange(
  preset: Preset,
  today: Month,
  extent: { first: Month; last: Month } | null
): { from: Month; to: Month } | null {
  if (preset === 'all') return extent ? { from: extent.first, to: extent.last } : null;
  const n = preset === '12m' ? 12 : 24;
  const end = extent && extent.last < today ? extent.last : today;
  return { from: addMonths(end, -(n - 1)), to: end };
}

/** ISO buckets: one per full stop, with open-ended ends. */
export const ISO_BINS = [
  { label: '≤100', max: 100 },
  { label: '200', max: 200 },
  { label: '400', max: 400 },
  { label: '800', max: 800 },
  { label: '1600', max: 1600 },
  { label: '3200', max: 3200 },
  { label: '6400', max: 6400 },
  { label: '12800+', max: Infinity },
] as const;

/**
 * Index into ISO_BINS: the smallest full stop at or above the value, so
 * third-stops round up (ISO 250 and 320 count as 400; 64 counts as ≤100).
 */
export function isoBin(iso: number): number {
  return ISO_BINS.findIndex((b) => iso <= b.max);
}

/** APEX aperture value (Av) → f-number, e.g. 5 → f/5.6. */
export function apexToFNumber(av: number): number {
  return Math.pow(2, av / 2);
}

/** APEX shutter value (Tv) → exposure time in seconds, e.g. 8 → 1/256 s. */
export function apexToSeconds(tv: number): number {
  return Math.pow(2, -tv);
}
