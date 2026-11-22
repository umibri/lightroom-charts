import { beforeAll, describe, expect, it } from 'vitest';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { fromSqlJs, type Db } from './db.ts';
import { buildCatalog, demoPhotos, type FixtureOptions, type FixturePhoto } from './fixtures.ts';
import { detectExifLink, diagnose, healthWarnings } from './diagnose.ts';
import { getTopCameras } from './queries.ts';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await initSqlJs({ useOldExtensionFunctions: false });
});

const open = (photos: FixturePhoto[], options?: FixtureOptions): Db =>
  fromSqlJs(buildCatalog(SQL, photos, options));
const demo = demoPhotos(300, { year: 2026, month: 6 });

describe('detectExifLink', () => {
  it('uses the image id when EXIF rows point at Adobe_images.id_local', () => {
    expect(detectExifLink(open(demo))).toBe('id_local');
  });

  it('switches to rootFile when EXIF rows point at AgLibraryFile ids', () => {
    expect(detectExifLink(open(demo, { exifKeyedBy: 'file' }))).toBe('rootFile');
  });

  it('falls back to id_local when there is no rootFile column', () => {
    const raw = new SQL.Database();
    raw.run(`CREATE TABLE Adobe_images (id_local INTEGER PRIMARY KEY, captureTime TEXT, masterImage INTEGER);
             CREATE TABLE AgHarvestedExifMetadata (id_local INTEGER PRIMARY KEY, image INTEGER);`);
    expect(detectExifLink(fromSqlJs(raw))).toBe('id_local');
  });

  it('makes camera counts correct under either layout', () => {
    for (const exifKeyedBy of ['image', 'file'] as const) {
      const db = open(demo, { exifKeyedBy });
      db.exifLink = detectExifLink(db);
      const unknown = getTopCameras(db, null, 100).find((r) => r.name === '[Unknown]');
      // demoPhotos leaves ~3% of cameras blank; a wrong join would make ~100% unknown.
      expect(unknown?.count ?? 0).toBeLessThan(30);
    }
  });

  it('a wrong join really would bucket everything as [Unknown] (why detection matters)', () => {
    const db = open(demo, { exifKeyedBy: 'file' }); // exifLink left at default id_local
    const cams = getTopCameras(db, null, 100);
    expect(cams).toEqual([{ name: '[Unknown]', count: 300 }]);
  });
});

describe('diagnose and warnings', () => {
  it('reports a healthy catalog without warnings', () => {
    const db = open(demo);
    const h = diagnose(db, detectExifLink(db));
    expect(h).toMatchObject({ exifLink: 'id_local', photos: 300, withExif: 300, undated: 0 });
    expect(h.captureTimeSamples).toHaveLength(3);
    expect(h.captureTimeSamples[0]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(healthWarnings(h)).toEqual([]);
  });

  it('warns when most photos have no EXIF match or no usable date', () => {
    const photos: FixturePhoto[] = [
      { captureTime: '2025-01-01T00:00:00', noExif: true },
      { captureTime: '2025-01-01T00:00:00', noExif: true },
      { captureTime: '734567890.5', camera: 'X' }, // e.g. a numeric timestamp format
      { captureTime: null, camera: 'X' },
    ];
    const db = open(photos);
    const h = diagnose(db, 'id_local');
    expect(h).toMatchObject({ photos: 4, withExif: 2, undated: 2 });
    // Exactly half: not over the threshold.
    expect(healthWarnings(h)).toEqual([]);
    const h2 = { ...h, withExif: 1, undated: 3 };
    expect(healthWarnings(h2).map((w) => w.kind)).toEqual(['exif', 'dates']);
  });

  it('never warns on an empty catalog', () => {
    const db = open([]);
    expect(healthWarnings(diagnose(db, 'id_local'))).toEqual([]);
  });
});
