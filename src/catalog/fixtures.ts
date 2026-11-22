// Builds small synthetic catalogs with Lightroom Classic's table/column names,
// for tests and the demo/debug scripts. Only the tables the app reads are
// created, plus a couple of realistic extras.
import type { Database, SqlJsStatic } from 'sql.js';

export interface FixturePhoto {
  /** Lightroom stores local wall-clock time, e.g. '2025-03-01T10:00:00' or with '.123'. */
  captureTime?: string | null;
  camera?: string | null;
  lens?: string | null;
  iso?: number | null;
  /** APEX aperture value as Lightroom stores it (e.g. 3 ≈ f/2.8). */
  aperture?: number | null;
  /** APEX shutter value as Lightroom stores it (e.g. 7.64 ≈ 1/200 s). */
  shutter?: number | null;
  /** Actual focal length in mm. */
  focal?: number | null;
  video?: boolean;
  /** Make this a virtual copy of the photo at this (0-based) index. */
  virtualOf?: number;
  /** Extra duplicate EXIF rows for this photo (Lightroom normally has one). */
  extraExifRows?: number;
  /** Omit the EXIF row entirely. */
  noExif?: boolean;
}

export interface FixtureOptions {
  /**
   * Which id AgHarvestedExifMetadata.image holds. Lightroom uses the image id
   * (Adobe_images.id_local); 'file' simulates the AgLibraryFile.id_local
   * variant one community schema note describes, so detection can be tested.
   */
  exifKeyedBy?: 'image' | 'file';
}

export function buildCatalog(
  SQL: SqlJsStatic,
  photos: FixturePhoto[],
  options: FixtureOptions = {}
): Database {
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE Adobe_images (
      id_local INTEGER PRIMARY KEY, id_global TEXT, captureTime TEXT,
      fileFormat TEXT, masterImage INTEGER, rating INTEGER, pick INTEGER, rootFile INTEGER
    );
    CREATE TABLE AgLibraryFile (id_local INTEGER PRIMARY KEY, baseName TEXT, extension TEXT);
    CREATE TABLE AgHarvestedExifMetadata (
      id_local INTEGER PRIMARY KEY, image INTEGER, cameraModelRef INTEGER,
      lensRef INTEGER, isoSpeedRating NUMBER, aperture NUMBER, shutterSpeed NUMBER,
      focalLength NUMBER
    );
    CREATE INDEX index_AgHarvestedExifMetadata_image ON AgHarvestedExifMetadata(image);
    CREATE TABLE AgInternedExifCameraModel (id_local INTEGER PRIMARY KEY, value TEXT, searchIndex TEXT);
    CREATE TABLE AgInternedExifLens (id_local INTEGER PRIMARY KEY, value TEXT, searchIndex TEXT);
    CREATE TABLE AgLibraryKeyword (id_local INTEGER PRIMARY KEY, name TEXT);
  `);

  const interned = (
    table: string,
    cache: Map<string, number>,
    value: string | null | undefined
  ) => {
    if (value == null) return null;
    let id = cache.get(value);
    if (id === undefined) {
      id = cache.size + 1;
      cache.set(value, id);
      db.run(`INSERT INTO ${table} (id_local, value) VALUES (?, ?)`, [id, value]);
    }
    return id;
  };
  const cams = new Map<string, number>();
  const lenses = new Map<string, number>();

  // Lightroom ids are not dense; offset them so tests can't rely on id == index.
  const idOf = (index: number) => 1000 + index * 3;
  // File ids deliberately differ from image ids, as in real catalogs.
  const fileIdOf = (index: number) => 50_000 + index * 7;
  let exifId = 1;

  photos.forEach((p, index) => {
    const id = idOf(index);
    db.run(
      `INSERT INTO Adobe_images (id_local, captureTime, fileFormat, masterImage, rootFile)
       VALUES (?, ?, ?, ?, ?)`,
      [
        id,
        p.captureTime ?? null,
        p.video ? 'VIDEO' : 'RAW',
        p.virtualOf === undefined ? null : idOf(p.virtualOf),
        // A virtual copy shares its master's file.
        fileIdOf(p.virtualOf ?? index),
      ]
    );
    if (p.virtualOf === undefined) {
      db.run(`INSERT INTO AgLibraryFile (id_local, baseName, extension) VALUES (?, ?, ?)`, [
        fileIdOf(index),
        `IMG_${index}`,
        p.video ? 'MP4' : 'RAF',
      ]);
    }
    if (p.noExif) return;
    const cam = interned('AgInternedExifCameraModel', cams, p.camera);
    const lens = interned('AgInternedExifLens', lenses, p.lens);
    for (let k = 0; k <= (p.extraExifRows ?? 0); k++) {
      db.run(
        `INSERT INTO AgHarvestedExifMetadata
           (id_local, image, cameraModelRef, lensRef, isoSpeedRating, aperture, shutterSpeed, focalLength)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          exifId++,
          options.exifKeyedBy === 'file' ? fileIdOf(index) : id,
          cam,
          lens,
          p.iso ?? null,
          p.aperture ?? null,
          p.shutter ?? null,
          p.focal ?? null,
        ]
      );
    }
  });
  return db;
}

/** Deterministic pseudo-random generator (mulberry32) for repeatable fixtures. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A realistic-looking demo catalog: n photos spread over `months` ending at `last`. */
export function demoPhotos(n: number, last: { year: number; month: number }, months = 30) {
  const rnd = seeded(42);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  // [lens, min focal mm, max focal mm, widest aperture as APEX Av]
  type Lens = readonly [string, number, number, number];
  const kits: [string, Lens[]][] = [
    [
      'X-T5',
      [
        ['XF23mmF1.4 R LM WR', 23, 23, 0.97],
        ['XF56mmF1.2 R WR', 56, 56, 0.53],
        ['XF16-55mmF2.8 R LM WR', 16, 55, 2.97],
      ],
    ],
    [
      'ILCE-7M4',
      [
        ['FE 35mm F1.8', 35, 35, 1.7],
        ['FE 24-70mm F2.8 GM II', 24, 70, 2.97],
        ['FE 85mm F1.8', 85, 85, 1.7],
      ],
    ],
    ['iPhone 15 Pro', [['iPhone 15 Pro back triple camera 6.765mm f/1.78', 6.765, 6.765, 1.66]]],
  ];
  const isos = [100, 125, 160, 200, 250, 320, 400, 640, 800, 1250, 1600, 3200, 6400, 12800];
  // Daytime-heavy hours, as real shooting tends to be.
  const hours = [
    7, 8, 9, 10, 10, 11, 11, 12, 13, 14, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22,
  ];
  const photos: FixturePhoto[] = [];
  for (let k = 0; k < n; k++) {
    const back = Math.floor(rnd() * months);
    const m0 = last.year * 12 + (last.month - 1) - back;
    const y = Math.floor(m0 / 12);
    const mo = (m0 % 12) + 1;
    const d = 1 + Math.floor(rnd() * 28);
    const [camera, lenses] = pick(kits);
    const [lens, fMin, fMax, widest] = pick(lenses);
    const blankLens = rnd() < 0.08;
    // Stopped down 0–3 stops in third-stop steps; mostly hand-held shutter speeds.
    const av = widest + Math.round(rnd() * 9) / 3;
    const tv = rnd() < 0.03 ? -Math.round(rnd() * 5) : 5 + Math.round(rnd() * 15) / 3;
    photos.push({
      captureTime: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(
        pick(hours)
      ).padStart(2, '0')}:00:00`,
      camera: rnd() < 0.03 ? null : camera,
      lens: blankLens ? '' : lens,
      iso: rnd() < 0.02 ? null : pick(isos),
      aperture: Math.round(av * 1000) / 1000,
      shutter: Math.round(tv * 1000) / 1000,
      focal: Math.round(fMin + rnd() * (fMax - fMin)),
      video: rnd() < 0.04,
    });
  }
  return photos;
}
