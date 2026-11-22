import type { Db, Param } from './db.ts';
import {
  ISO_BINS,
  isoBin,
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

function where(range: MonthRange | null): { sql: string; params: Param[] } {
  const parts = [ORIGINALS];
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
  const w = where(range);
  return db.all<NameCount>(
    `SELECT COALESCE(NULLIF(TRIM(t.value), ''), '${UNKNOWN}') AS name, COUNT(*) AS count
     FROM ${photos(db)} LEFT JOIN ${table} AS t ON t.id_local = exif.${ref}
     ${w.sql}
     GROUP BY 1 ORDER BY count DESC, name = '${UNKNOWN}', name ASC LIMIT ?`,
    [...w.params, limit]
  );
}

/** Top cameras by photo count. Missing/blank camera is bucketed as [Unknown]. */
export function getTopCameras(db: Db, range: MonthRange | null, limit = 15): NameCount[] {
  return topBy(db, 'AgInternedExifCameraModel', 'cameraModelRef', range, limit);
}

/** Top lenses by photo count. Missing/blank lens is bucketed as [Unknown]. */
export function getTopLenses(db: Db, range: MonthRange | null, limit = 15): NameCount[] {
  return topBy(db, 'AgInternedExifLens', 'lensRef', range, limit);
}

export interface IsoHistogram {
  bins: { label: string; count: number }[];
  unknown: number;
}

/** Photos per full-stop ISO bin; photos without a positive ISO count as unknown. */
export function getIsoHistogram(db: Db, range: MonthRange | null): IsoHistogram {
  const w = where(range);
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
