import { beforeAll, describe, expect, it } from 'vitest';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { fromSqlJs, type Db } from './db.ts';
import { buildCatalog, demoPhotos, type FixturePhoto } from './fixtures.ts';
import {
  getExposure,
  getIsoHistogram,
  getSummary,
  getTimeline,
  getTimeOfWeek,
  getTopCameras,
  getTopLenses,
  getVideoCount,
  UNKNOWN,
} from './queries.ts';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await initSqlJs({ useOldExtensionFunctions: false });
});

const open = (photos: FixturePhoto[]): Db => fromSqlJs(buildCatalog(SQL, photos));

// Edge cases Lightroom catalogs actually contain.
const EDGE: FixturePhoto[] = [
  /* 0 */ { captureTime: '2025-01-05T10:00:00', camera: 'X-T5', lens: 'XF23', iso: 200 },
  /* 1 */ { captureTime: '2025-01-20T23:59:59.123', camera: 'X-T5', lens: 'XF56', iso: 320 },
  /* 2 */ { captureTime: '2025-03-01T00:00:00', camera: 'A7IV', lens: '', iso: 6400 },
  /* 3 */ { captureTime: '2025-03-02T08:00:00+02:00', camera: '  ', lens: null, iso: null },
  /* 4 */ { captureTime: null, camera: 'X-T5', lens: 'XF23', iso: 100 }, // undated
  /* 5 */ { captureTime: '', camera: 'X-T5', lens: 'XF23', iso: 100 }, // undated
  /* 6 */ { captureTime: '2025-01-05T10:00:00', virtualOf: 0, camera: 'X-T5', lens: 'XF23' },
  /* 7 */ {
    captureTime: '2025-03-10T12:00:00',
    camera: 'A7IV',
    lens: 'FE35',
    iso: 800,
    extraExifRows: 2,
  },
  /* 8 */ { captureTime: '2024-12-31T23:00:00', noExif: true },
  /* 9 */ { captureTime: '2025-01-15T09:00:00', camera: 'A7IV', lens: 'FE35', iso: 0, video: true },
];

describe('getSummary', () => {
  it('counts originals only and reports catalog extent', () => {
    expect(getSummary(open(EDGE))).toEqual({
      photos: 9, // 10 rows minus 1 virtual copy
      videos: 1,
      virtualCopies: 1,
      undated: 2,
      firstMonth: '2024-12',
      lastMonth: '2025-03',
      cameras: 2, // X-T5, A7IV (blank camera ignored)
      lenses: 3, // XF23, XF56, FE35
    });
  });

  it('handles an empty catalog', () => {
    expect(getSummary(open([]))).toMatchObject({
      photos: 0,
      videos: 0,
      undated: 0,
      firstMonth: null,
      lastMonth: null,
    });
  });
});

describe('getTimeline', () => {
  it('is zero-filled, excludes virtual copies and undated rows, counts duplicate EXIF once', () => {
    expect(getTimeline(open(EDGE), { from: '2024-11', to: '2025-04' })).toEqual([
      { month: '2024-11', count: 0 },
      { month: '2024-12', count: 1 },
      { month: '2025-01', count: 3 }, // 0, 1, 9 (virtual copy 6 excluded)
      { month: '2025-02', count: 0 },
      { month: '2025-03', count: 3 }, // 2, 3, 7 (7 has 3 EXIF rows)
      { month: '2025-04', count: 0 },
    ]);
  });

  it('respects range bounds inclusively', () => {
    const t = getTimeline(open(EDGE), { from: '2025-01', to: '2025-01' });
    expect(t).toEqual([{ month: '2025-01', count: 3 }]);
  });
});

describe('top cameras / lenses', () => {
  it('buckets missing/blank as [Unknown]; sorts by count, [Unknown] last on ties, then name', () => {
    // Stills only: the video (row 9, A7IV/FE35) is excluded.
    expect(getTopCameras(open(EDGE), null)).toEqual([
      { name: 'X-T5', count: 4 },
      { name: 'A7IV', count: 2 },
      { name: UNKNOWN, count: 2 }, // blank camera + no EXIF row; loses the tie
    ]);
    expect(getTopLenses(open(EDGE), null)).toEqual([
      { name: 'XF23', count: 3 },
      { name: UNKNOWN, count: 3 }, // '' + null + no EXIF row; loses the tie
      { name: 'FE35', count: 1 },
      { name: 'XF56', count: 1 },
    ]);
  });

  it('applies the month range', () => {
    expect(getTopCameras(open(EDGE), { from: '2025-03', to: null })).toEqual([
      { name: 'A7IV', count: 2 },
      { name: UNKNOWN, count: 1 },
    ]);
  });

  it('limits to N (default 15) and still works with fewer', () => {
    const many: FixturePhoto[] = Array.from({ length: 20 }, (_, k) => ({
      captureTime: '2025-01-01T00:00:00',
      lens: `Lens ${String(k).padStart(2, '0')}`,
    }));
    expect(getTopLenses(open(many), null)).toHaveLength(15);
    expect(getTopLenses(open(many), null, 3).map((r) => r.name)).toEqual([
      'Lens 00',
      'Lens 01',
      'Lens 02',
    ]);
  });
});

describe('getVideoCount', () => {
  it('counts videos (originals only) within the range', () => {
    expect(getVideoCount(open(EDGE), null)).toBe(1);
    expect(getVideoCount(open(EDGE), { from: '2025-01', to: '2025-01' })).toBe(1);
    expect(getVideoCount(open(EDGE), { from: '2025-03', to: null })).toBe(0);
  });
});

describe('getIsoHistogram', () => {
  it('bins by full stop and counts missing/zero ISO as unknown', () => {
    const h = getIsoHistogram(open(EDGE), null);
    const byLabel = Object.fromEntries(h.bins.map((b) => [b.label, b.count]));
    expect(byLabel).toMatchObject({ '≤100': 2, '200': 1, '400': 1, '800': 1, '6400': 1 });
    expect(h.unknown).toBe(2); // null ISO + no EXIF row (the ISO-0 video is excluded)
    expect(h.bins.reduce((s, b) => s + b.count, 0) + h.unknown).toBe(8); // 9 originals - 1 video
  });
});

describe('consistency on a larger catalog', () => {
  it('every view of the data agrees on the photo total', () => {
    const db = open(demoPhotos(2000, { year: 2026, month: 10 }));
    const s = getSummary(db);
    const range = { from: s.firstMonth!, to: s.lastMonth! };
    const timelineTotal = getTimeline(db, range).reduce((n, r) => n + r.count, 0);
    const cams = getTopCameras(db, null, 1000).reduce((n, r) => n + r.count, 0);
    const iso = getIsoHistogram(db, null);
    const isoTotal = iso.bins.reduce((n, b) => n + b.count, 0) + iso.unknown;
    expect(s.photos).toBe(2000);
    expect(timelineTotal).toBe(s.photos - s.undated);
    // Gear and ISO charts count stills only.
    expect(cams).toBe(s.photos - s.videos);
    expect(isoTotal).toBe(s.photos - s.videos);
    expect(getVideoCount(db, null)).toBe(s.videos);
  });
});

describe('getExposure', () => {
  // Values as Lightroom stores them: APEX aperture/shutter, focal in mm.
  const SHOTS: FixturePhoto[] = [
    { captureTime: '2025-01-06T09:00:00', aperture: 2.9709, shutter: 7.6439, focal: 24 }, // f/2.8, 1/200, 24mm
    { captureTime: '2025-01-06T10:00:00', aperture: 4.9709, shutter: 7.9658, focal: 55 }, // f/5.6, 1/250, 55mm
    { captureTime: '2025-01-07T21:00:00', aperture: 1.696, shutter: 0, focal: 50 }, // f/1.8, 1s, 50mm
    { captureTime: '2025-02-01T12:00:00', aperture: null, shutter: null, focal: null }, // no exposure data
    { captureTime: '2025-02-01T12:00:00', video: true, aperture: 3, shutter: 6, focal: 24 }, // video: excluded
    { captureTime: '2025-02-01T12:00:00', virtualOf: 0, aperture: 3, shutter: 6, focal: 24 }, // copy: excluded
  ];
  const count = (h: { bins: { label: string; count: number }[] }, label: string) =>
    h.bins.find((b) => b.label === label)?.count;

  it('bins stills by nearest stop / focal range; unknown counts missing values', () => {
    const e = getExposure(open(SHOTS), null);
    expect(count(e.aperture, 'f/2.8')).toBe(1);
    expect(count(e.aperture, 'f/5.6')).toBe(1);
    expect(count(e.aperture, 'f/2')).toBe(1);
    expect(e.aperture.unknown).toBe(1);
    expect(count(e.shutter, '1/125–1/250')).toBe(2);
    expect(count(e.shutter, '1s or longer')).toBe(1);
    expect(e.shutter.unknown).toBe(1);
    expect(count(e.focal, '17–24')).toBe(1);
    expect(count(e.focal, '36–50')).toBe(1);
    expect(count(e.focal, '51–85')).toBe(1);
    expect(e.focal.unknown).toBe(1);
  });

  it('every histogram accounts for exactly the stills in range', () => {
    const e = getExposure(open(SHOTS), { from: '2025-01', to: '2025-01' });
    for (const h of [e.aperture, e.shutter, e.focal]) {
      expect(h.bins.reduce((n, b) => n + b.count, 0) + h.unknown).toBe(3);
    }
  });
});

describe('getTimeOfWeek', () => {
  it('counts by local hour and Monday-first weekday, including videos', () => {
    // 2025-01-06 is a Monday, 2025-01-07 a Tuesday, 2025-02-01 a Saturday.
    const t = getTimeOfWeek(
      open([
        { captureTime: '2025-01-06T09:15:00' },
        { captureTime: '2025-01-06T09:59:59.99' },
        { captureTime: '2025-01-07T21:00:00+02:00' }, // zone suffix ignored: hour as written
        { captureTime: '2025-02-01T00:30:00', video: true },
        { captureTime: null }, // undated: excluded
        { captureTime: '2025-01-06T09:00:00', virtualOf: 0 }, // copy: excluded
      ]),
      null
    );
    expect(t.hours[9]).toBe(2);
    expect(t.hours[21]).toBe(1);
    expect(t.hours[0]).toBe(1);
    expect(t.hours.reduce((a, b) => a + b, 0)).toBe(4);
    expect(t.weekdays).toEqual([2, 1, 0, 0, 0, 1, 0]); // Mon, Tue, …, Sat
  });

  it('respects the month range', () => {
    const t = getTimeOfWeek(
      open([{ captureTime: '2025-01-06T09:00:00' }, { captureTime: '2025-02-03T09:00:00' }]),
      { from: '2025-02', to: '2025-02' }
    );
    expect(t.hours[9]).toBe(1);
  });
});
