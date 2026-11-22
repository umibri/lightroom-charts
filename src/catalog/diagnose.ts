// Sanity checks run when a catalog opens. Lightroom's schema is undocumented,
// so instead of trusting one reading of it, measure how well the data joins
// and surface problems rather than silently showing [Unknown].
import type { Db, ExifLink } from './db.ts';

const ORIGINALS = `masterImage IS NULL`;

function hasColumn(db: Db, table: string, column: string): boolean {
  return db
    .all<{ name: string }>(`SELECT name FROM pragma_table_info(?)`, [table])
    .some((r) => r.name === column);
}

function exifMatches(db: Db, link: ExifLink): number {
  const [row] = db.all<{ n: number }>(
    `SELECT COUNT(*) AS n FROM Adobe_images AS i
     WHERE ${ORIGINALS}
       AND EXISTS (SELECT 1 FROM AgHarvestedExifMetadata AS e WHERE e.image = i.${link})`
  );
  return row.n;
}

/**
 * Which Adobe_images column EXIF rows point at. Lightroom uses the image id;
 * fall back to the file id only if it clearly matches more photos.
 */
export function detectExifLink(db: Db): ExifLink {
  if (!hasColumn(db, 'Adobe_images', 'rootFile')) return 'id_local';
  return exifMatches(db, 'rootFile') > exifMatches(db, 'id_local') ? 'rootFile' : 'id_local';
}

export interface Health {
  exifLink: ExifLink;
  /** Original photos (virtual copies excluded). */
  photos: number;
  /** Originals with an EXIF row under the chosen link. */
  withExif: number;
  /** Originals whose captureTime isn't a 'YYYY-MM…' date. */
  undated: number;
  /** A few raw captureTime values, for the inspect CLI (never sent anywhere). */
  captureTimeSamples: string[];
}

export function diagnose(db: Db, exifLink: ExifLink): Health {
  const [counts] = db.all<{ photos: number; undated: number }>(
    `SELECT COUNT(*) AS photos,
       SUM(captureTime IS NULL OR NOT captureTime GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]*') AS undated
     FROM Adobe_images WHERE ${ORIGINALS}`
  );
  const samples = db.all<{ t: string }>(
    `SELECT DISTINCT CAST(captureTime AS TEXT) AS t FROM Adobe_images
     WHERE captureTime IS NOT NULL ORDER BY id_local LIMIT 3`
  );
  return {
    exifLink,
    photos: counts.photos,
    withExif: exifMatches(db, exifLink),
    undated: counts.undated ?? 0,
    captureTimeSamples: samples.map((r) => r.t),
  };
}

export interface HealthWarning {
  kind: 'exif' | 'dates';
  share: number;
}

/** Problems worth telling the user about: over half the photos affected. */
export function healthWarnings(h: Health): HealthWarning[] {
  if (h.photos === 0) return [];
  const out: HealthWarning[] = [];
  const noExif = (h.photos - h.withExif) / h.photos;
  const undated = h.undated / h.photos;
  if (noExif > 0.5) out.push({ kind: 'exif', share: noExif });
  if (undated > 0.5) out.push({ kind: 'dates', share: undated });
  return out;
}
