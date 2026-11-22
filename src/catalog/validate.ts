import type { Db } from './db.ts';

/** Why a file was rejected. UI copy lives with the UI; these are stable codes. */
export type CatalogErrorCode = 'not-sqlite' | 'not-lightroom' | 'open-failed';

export class CatalogError extends Error {
  readonly code: CatalogErrorCode;
  constructor(code: CatalogErrorCode, message: string) {
    super(message);
    this.name = 'CatalogError';
    this.code = code;
  }
}

const MAGIC = 'SQLite format 3\0';

export interface HeaderInfo {
  /** Database was last written in WAL mode (header bytes 18/19 == 2). */
  wal: boolean;
}

/**
 * Check the 100-byte SQLite header before handing bytes to the engine, so a
 * renamed .txt/.jpg gets a clear error instead of a cryptic SQLite failure.
 */
export function checkHeader(bytes: Uint8Array): HeaderInfo {
  if (bytes.length < 100) throw new CatalogError('not-sqlite', 'File is too small to be a catalog');
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC.charCodeAt(i)) {
      throw new CatalogError('not-sqlite', 'File is not a SQLite database');
    }
  }
  return { wal: bytes[18] === 2 || bytes[19] === 2 };
}

/** Tables (and the columns we read) that every Lightroom Classic catalog has. */
export const REQUIRED: Record<string, string[]> = {
  Adobe_images: ['id_local', 'captureTime', 'masterImage', 'fileFormat'],
  AgHarvestedExifMetadata: ['image', 'cameraModelRef', 'lensRef', 'isoSpeedRating'],
  AgInternedExifCameraModel: ['id_local', 'value'],
  AgInternedExifLens: ['id_local', 'value'],
};

/** Returns "Table.column" names that are missing; empty means it looks like Lightroom. */
export function missingSchema(db: Db): string[] {
  const missing: string[] = [];
  for (const [table, cols] of Object.entries(REQUIRED)) {
    const have = new Set(
      db.all<{ name: string }>(`SELECT name FROM pragma_table_info(?)`, [table]).map((r) => r.name)
    );
    if (have.size === 0) {
      missing.push(table);
      continue;
    }
    for (const c of cols) if (!have.has(c)) missing.push(`${table}.${c}`);
  }
  return missing;
}

export function assertLightroom(db: Db) {
  const missing = missingSchema(db);
  if (missing.length) {
    throw new CatalogError(
      'not-lightroom',
      `Not a Lightroom Classic catalog (missing ${missing.slice(0, 3).join(', ')}${
        missing.length > 3 ? '…' : ''
      })`
    );
  }
}
