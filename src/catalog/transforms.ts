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

// --- Exposure and time bins (Phase 5) ---------------------------------------
// Values come straight from AgHarvestedExifMetadata. Checked against a real
// Lightroom Classic 13 catalog: aperture and shutterSpeed are APEX values,
// focalLength is the actual focal length in mm (not 35mm-equivalent).

/** Focal length as recorded (mm), grouped by common prime/zoom ranges. */
export const FOCAL_BINS = [
  { label: '≤16', max: 16 },
  { label: '17–24', max: 24 },
  { label: '25–35', max: 35 },
  { label: '36–50', max: 50 },
  { label: '51–85', max: 85 },
  { label: '86–135', max: 135 },
  { label: '136–200', max: 200 },
  { label: '201+', max: Infinity },
] as const;

/** Index into FOCAL_BINS, or -1 when there's no usable value. Rounds to whole mm first (24.4 → 24). */
export function focalBin(mm: number | null | undefined): number {
  if (typeof mm !== 'number' || !(mm > 0)) return -1;
  const r = Math.round(mm);
  return FOCAL_BINS.findIndex((b) => r <= b.max);
}

/** Aperture by nearest full stop: Av rounded to an integer, clamped to f/1.4…f/16+. */
export const APERTURE_BINS = [
  { label: '≤f/1.4' }, // Av ≤ 1
  { label: 'f/2' }, // Av 2
  { label: 'f/2.8' }, // Av 3
  { label: 'f/4' },
  { label: 'f/5.6' },
  { label: 'f/8' },
  { label: 'f/11' },
  { label: 'f/16+' }, // Av ≥ 8
] as const;

export function apertureBin(av: number | null | undefined): number {
  if (typeof av !== 'number' || !Number.isFinite(av) || av <= 0) return -1;
  const stop = Math.min(8, Math.max(1, Math.round(av)));
  return stop - 1;
}

/** Shutter speed groups by nearest full stop of the APEX Tv value. */
export const SHUTTER_BINS = [
  { label: '1s or longer', maxStop: 0 },
  { label: '1/2–1/15', maxStop: 4 },
  { label: '1/30–1/60', maxStop: 6 },
  { label: '1/125–1/250', maxStop: 8 },
  { label: '1/500–1/1000', maxStop: 10 },
  { label: '1/2000+', maxStop: Infinity },
] as const;

/** Tv 0 is a genuine 1 s exposure (seen in real catalogs), so only non-numbers are unknown. */
export function shutterBin(tv: number | null | undefined): number {
  if (typeof tv !== 'number' || !Number.isFinite(tv)) return -1;
  const stop = Math.round(tv);
  return SHUTTER_BINS.findIndex((b) => stop <= b.maxStop);
}

/** Hour labels 00–23 (local wall-clock time as Lightroom stores it). */
export const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));

/** Monday-first, matching most calendars outside the US. */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** SQLite strftime('%w') gives 0 = Sunday; convert to a Monday-first index. */
export function mondayFirst(sqliteWeekday: number): number {
  return (sqliteWeekday + 6) % 7;
}
