import type { Db, Param } from './db.ts';
import {
  APERTURE_BINS,
  apertureBin,
  FOCAL_BINS,
  focalBin,
  ISO_BINS,
  isoBin,
  mondayFirst,
  SHUTTER_BINS,
  shutterBin,
  zeroFillMonths,
  type Month,
  type MonthCount,
  type MonthRange,
} from './transforms.ts';

export const UNKNOWN = '[Unknown]';

// Rules shared by every query:
// - Virtual copies (masterImage set) are excluded: they are the same photo.
// - One EXIF row per photo (lowest id), so a photo is never counted twice.
// - Month = first 7 chars of captureTime ('YYYY-MM'); rows without a valid
//   date only appear in the summary's `undated` count.
function photos(db: Db): string {
  const link = db.exifLink ?? 'id_local';
  return `Adobe_images AS i
  LEFT JOIN (SELECT image, MIN(id_local) AS id FROM AgHarvestedExifMetadata GROUP BY image) AS one
    ON one.image = i.${link}
  LEFT JOIN AgHarvestedExifMetadata AS exif ON exif.id_local = one.id`;
}
const MONTH = `substr(i.captureTime, 1, 7)`;
const DATED = `i.captureTime GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]*'`;
const ORIGINALS = `i.masterImage IS NULL`;

// Lightroom records no camera/lens/ISO for videos, so gear and exposure
// charts count stills only (videos would all land in [Unknown]).
const STILLS = `COALESCE(i.fileFormat, '') <> 'VIDEO'`;

function where(
  range: MonthRange | null,
  { stillsOnly = false } = {}
): { sql: string; params: Param[] } {
  const parts = [ORIGINALS];
  if (stillsOnly) parts.push(STILLS);
  const params: Param[] = [];
  if (range) {
    parts.push(DATED);
    if (range.from) {
      parts.push(`${MONTH} >= ?`);
      params.push(range.from);
    }
    if (range.to) {
      parts.push(`${MONTH} <= ?`);
      params.push(range.to);
    }
  }
  return { sql: `WHERE ${parts.join(' AND ')}`, params };
}

export interface Summary {
  photos: number;
  videos: number;
  virtualCopies: number;
  undated: number;
  firstMonth: Month | null;
  lastMonth: Month | null;
  cameras: number;
  lenses: number;
}

export function getSummary(db: Db): Summary {
  const [row] = db.all<Omit<Summary, 'virtualCopies'>>(
    `SELECT
       COUNT(*) AS photos,
       SUM(i.fileFormat = 'VIDEO') AS videos,
       SUM(NOT (${DATED}) OR i.captureTime IS NULL) AS undated,
       MIN(CASE WHEN ${DATED} THEN ${MONTH} END) AS firstMonth,
       MAX(CASE WHEN ${DATED} THEN ${MONTH} END) AS lastMonth,
       COUNT(DISTINCT NULLIF(TRIM(cam.value), '')) AS cameras,
       COUNT(DISTINCT NULLIF(TRIM(lens.value), '')) AS lenses
     FROM ${photos(db)}
       LEFT JOIN AgInternedExifCameraModel AS cam ON cam.id_local = exif.cameraModelRef
       LEFT JOIN AgInternedExifLens AS lens ON lens.id_local = exif.lensRef
     WHERE ${ORIGINALS}`
  );
  const [vc] = db.all<{ n: number }>(
    `SELECT COUNT(*) AS n FROM Adobe_images WHERE masterImage IS NOT NULL`
  );
  return {
    photos: row.photos,
    videos: row.videos ?? 0,
    virtualCopies: vc.n,
    undated: row.undated ?? 0,
    firstMonth: row.firstMonth ?? null,
    lastMonth: row.lastMonth ?? null,
    cameras: row.cameras,
    lenses: row.lenses,
  };
}

/** Photos per month across from..to inclusive, zero-filled. */
export function getTimeline(db: Db, range: { from: Month; to: Month }): MonthCount[] {
  const w = where(range);
  const rows = db.all<MonthCount>(
    `SELECT ${MONTH} AS month, COUNT(*) AS count FROM Adobe_images AS i ${w.sql} GROUP BY 1`,
    w.params
  );
  return zeroFillMonths(rows, range.from, range.to);
}

export interface NameCount {
  name: string;
  count: number;
}

function topBy(
  db: Db,
  table: string,
  ref: string,
  range: MonthRange | null,
  limit: number
): NameCount[] {
  const w = where(range, { stillsOnly: true });
  return db.all<NameCount>(
    `SELECT COALESCE(NULLIF(TRIM(t.value), ''), '${UNKNOWN}') AS name, COUNT(*) AS count
     FROM ${photos(db)} LEFT JOIN ${table} AS t ON t.id_local = exif.${ref}
     ${w.sql}
     GROUP BY 1 ORDER BY count DESC, name = '${UNKNOWN}', name ASC LIMIT ?`,
    [...w.params, limit]
  );
}

/** Videos in the range: left out of camera, lens and ISO charts. */
export function getVideoCount(db: Db, range: MonthRange | null): number {
  const w = where(range);
  const [row] = db.all<{ n: number }>(
    `SELECT COUNT(*) AS n FROM Adobe_images AS i ${w.sql} AND i.fileFormat = 'VIDEO'`,
    w.params
  );
  return row.n;
}

/** Top cameras by photo count (stills only). Missing/blank camera is bucketed as [Unknown]. */
export function getTopCameras(db: Db, range: MonthRange | null, limit = 15): NameCount[] {
  return topBy(db, 'AgInternedExifCameraModel', 'cameraModelRef', range, limit);
}

/** Top lenses by photo count (stills only). Missing/blank lens is bucketed as [Unknown]. */
export function getTopLenses(db: Db, range: MonthRange | null, limit = 15): NameCount[] {
  return topBy(db, 'AgInternedExifLens', 'lensRef', range, limit);
}

export interface IsoHistogram {
  bins: { label: string; count: number }[];
  unknown: number;
}

/** Stills per full-stop ISO bin; photos without a positive ISO count as unknown. */
export function getIsoHistogram(db: Db, range: MonthRange | null): IsoHistogram {
  const w = where(range, { stillsOnly: true });
  const rows = db.all<{ iso: number | null; count: number }>(
    `SELECT exif.isoSpeedRating AS iso, COUNT(*) AS count FROM ${photos(db)} ${w.sql} GROUP BY 1`,
    w.params
  );
  const bins = ISO_BINS.map((b) => ({ label: b.label, count: 0 }));
  let unknown = 0;
  for (const r of rows) {
    if (typeof r.iso === 'number' && r.iso > 0) bins[isoBin(r.iso)].count += r.count;
    else unknown += r.count;
  }
  return { bins, unknown };
}

// --- Exposure and time charts (Phase 5) -------------------------------------

export interface Histogram {
  bins: { label: string; count: number }[];
  /** Stills with no usable value for this chart. */
  unknown: number;
}

/** Group by the raw column value in SQL, then bin in JS with a tested rule. */
function binned(
  db: Db,
  range: MonthRange | null,
  column: string,
  labels: readonly { label: string }[],
  binOf: (v: number | null) => number
): Histogram {
  const w = where(range, { stillsOnly: true });
  const rows = db.all<{ v: number | null; count: number }>(
    `SELECT exif.${column} AS v, COUNT(*) AS count FROM ${photos(db)} ${w.sql} GROUP BY 1`,
    w.params
  );
  const bins = labels.map((b) => ({ label: b.label, count: 0 }));
  let unknown = 0;
  for (const r of rows) {
    const i = binOf(r.v);
    if (i < 0) unknown += r.count;
    else bins[i].count += r.count;
  }
  return { bins, unknown };
}

export interface Exposure {
  focal: Histogram;
  aperture: Histogram;
  shutter: Histogram;
}

/** Focal length, aperture and shutter speed distributions (stills only). */
export function getExposure(db: Db, range: MonthRange | null): Exposure {
  return {
    focal: binned(db, range, 'focalLength', FOCAL_BINS, focalBin),
    aperture: binned(db, range, 'aperture', APERTURE_BINS, apertureBin),
    shutter: binned(db, range, 'shutterSpeed', SHUTTER_BINS, shutterBin),
  };
}

export interface TimeOfWeek {
  /** Photos per hour 00–23, from the capture time as written (local time). */
  hours: number[];
  /** Photos per weekday, Monday first. */
  weekdays: number[];
}

/** When photos were taken: hour of day and day of week. Includes videos, like the timeline. */
export function getTimeOfWeek(db: Db, range: MonthRange | null): TimeOfWeek {
  const w = where(range ?? { from: null, to: null });
  const hours = new Array(24).fill(0);
  const weekdays = new Array(7).fill(0);
  const rows = db.all<{ h: string; wd: string | null; count: number }>(
    `SELECT substr(i.captureTime, 12, 2) AS h,
            strftime('%w', substr(i.captureTime, 1, 10)) AS wd,
            COUNT(*) AS count
     FROM Adobe_images AS i ${w.sql}
     GROUP BY 1, 2`,
    w.params
  );
  for (const r of rows) {
    const h = Number(r.h);
    if (/^\d\d$/.test(r.h ?? '') && h >= 0 && h <= 23) hours[h] += r.count;
    if (r.wd != null) weekdays[mondayFirst(Number(r.wd))] += r.count;
  }
  return { hours, weekdays };
}
