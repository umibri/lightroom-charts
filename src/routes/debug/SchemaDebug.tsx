// Dev-only schema explorer (route: #/debug, not included in production builds).
// Probes the loaded catalog through the raw `query` bridge: lists tables, reconciles
// image counts across the EXIF joins, and shows Top-15 cameras/lenses with NULL/blank
// values bucketed as [Unknown]. Phase 1 moves these queries into tested modules.

import * as React from 'react';
import { query } from '@/lib/dbClient';

type MasterRow = { type: string; name: string; sql: string | null };
type NameCount = { name: string; cnt: number };

const IMAGE_TABLE = `Adobe_images AS images
  LEFT JOIN AgHarvestedExifMetadata AS exif ON images.id_local = exif.image
  LEFT JOIN AgInternedExifCameraModel AS camera ON exif.cameraModelRef = camera.id_local
  LEFT JOIN AgInternedExifLens AS lens ON exif.lensRef = lens.id_local`;
const TAKEN_AT_COL = 'images.captureTime';

const UNKNOWN_LABEL = '[Unknown]';
const CAM_LABEL = `COALESCE(NULLIF(TRIM(camera.value), ''), '${UNKNOWN_LABEL}')`;
const LENS_LABEL = `COALESCE(NULLIF(TRIM(lens.value), ''), '${UNKNOWN_LABEL}')`;

function topN(label: string, excludeUnknown: boolean) {
  return `SELECT ${label} AS name, COUNT(DISTINCT images.id_local) AS cnt
    FROM ${IMAGE_TABLE}
    WHERE ${TAKEN_AT_COL} >= ? AND ${TAKEN_AT_COL} < ?
      ${excludeUnknown ? `AND ${label} <> '${UNKNOWN_LABEL}'` : ''}
    GROUP BY 1
    ORDER BY cnt DESC, name ASC
    LIMIT 15;`;
}

function countWhere(from: string, extra = '') {
  return `SELECT COUNT(DISTINCT images.id_local) AS c FROM ${from}
    WHERE ${TAKEN_AT_COL} >= ? AND ${TAKEN_AT_COL} < ? ${extra};`;
}

export default function SchemaDebug() {
  const [excludeUnknown, setExcludeUnknown] = React.useState(false);
  const [master, setMaster] = React.useState<MasterRow[] | null>(null);
  const [error, setError] = React.useState('');
  const [summary, setSummary] = React.useState<{
    base: number;
    joined: number;
    distinct: number;
  } | null>(null);
  const [unknowns, setUnknowns] = React.useState<{ camera: number; lens: number } | null>(null);
  const [probes, setProbes] = React.useState<{ cameras: NameCount[]; lenses: NameCount[] } | null>(
    null
  );

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await query<MasterRow>(
          "SELECT type, name, sql FROM sqlite_master WHERE type IN ('table','view') ORDER BY type, name;"
        );
        if (cancelled) return;
        setMaster(m);
        console.log('[schema] sqlite_master', m);

        // Window: last 2 years up to now.
        const now = new Date();
        const start = new Date(now);
        start.setUTCFullYear(now.getUTCFullYear() - 2);
        const win = [start.toISOString(), now.toISOString()];

        const [base, joined, distinct, unkCam, unkLens, cameras, lenses] = await Promise.all([
          query<{ c: number }>(
            `SELECT COUNT(1) AS c FROM Adobe_images AS images
             WHERE ${TAKEN_AT_COL} >= ? AND ${TAKEN_AT_COL} < ?;`,
            win
          ),
          query<{ c: number }>(
            `SELECT COUNT(1) AS c FROM ${IMAGE_TABLE}
             WHERE ${TAKEN_AT_COL} >= ? AND ${TAKEN_AT_COL} < ?;`,
            win
          ),
          query<{ c: number }>(countWhere(IMAGE_TABLE), win),
          query<{ c: number }>(
            countWhere(IMAGE_TABLE, `AND ${CAM_LABEL} = '${UNKNOWN_LABEL}'`),
            win
          ),
          query<{ c: number }>(
            countWhere(IMAGE_TABLE, `AND ${LENS_LABEL} = '${UNKNOWN_LABEL}'`),
            win
          ),
          query<NameCount>(topN(CAM_LABEL, excludeUnknown), win),
          query<NameCount>(topN(LENS_LABEL, excludeUnknown), win),
        ]);
        if (cancelled) return;
        setSummary({
          base: base[0]?.c ?? 0,
          joined: joined[0]?.c ?? 0,
          distinct: distinct[0]?.c ?? 0,
        });
        setUnknowns({ camera: unkCam[0]?.c ?? 0, lens: unkLens[0]?.c ?? 0 });
        setProbes({ cameras, lenses });
      } catch (e) {
        if (!cancelled) setError((e as Error)?.message ?? 'Unknown error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [excludeUnknown]);

  const tableCount = master?.filter((r) => r.type === 'table').length ?? 0;
  const viewCount = master?.filter((r) => r.type === 'view').length ?? 0;
  const pct = (n: number) =>
    summary?.distinct ? ((n / summary.distinct) * 100).toFixed(1) : '0.0';

  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <h1 className="mb-2 text-lg font-semibold">Schema debug</h1>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={excludeUnknown}
          onChange={(e) => setExcludeUnknown(e.target.checked)}
        />
        Hide {UNKNOWN_LABEL} from Top-15 lists
      </label>
      {error && <div className="mb-3 text-red-600">{error}</div>}
      {!master && !error && <div className="text-sm opacity-70">Scanning…</div>}
      {master && (
        <>
          <div className="mb-2 text-sm opacity-80">
            {tableCount} tables • {viewCount} views
          </div>
          {summary && (
            <div className="mb-3 text-sm">
              <div className="font-medium">Window totals (last 2 years)</div>
              <ul className="list-disc pl-5 font-mono">
                <li>Images (base): {summary.base}</li>
                <li>Rows (joined): {summary.joined}</li>
                <li>Images (distinct in join): {summary.distinct}</li>
              </ul>
            </div>
          )}
          {unknowns && (
            <div className="mb-3 text-sm">
              <div className="font-medium">Unknown share</div>
              <ul className="list-disc pl-5 font-mono">
                <li>
                  Camera {UNKNOWN_LABEL}: {unknowns.camera} ({pct(unknowns.camera)}%)
                </li>
                <li>
                  Lens {UNKNOWN_LABEL}: {unknowns.lens} ({pct(unknowns.lens)}%)
                </li>
              </ul>
            </div>
          )}
          {probes && (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              {(['cameras', 'lenses'] as const).map((k) => (
                <div key={k}>
                  <div className="font-medium">{k === 'cameras' ? 'Camera' : 'Lens'} (Top 15)</div>
                  <ul className="list-disc pl-5 font-mono">
                    {probes[k].map((r) => (
                      <li key={r.name}>
                        {r.name} — {r.cnt}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <div className="mt-3 text-xs opacity-60">
        The full sqlite_master listing is logged to the console.
      </div>
    </div>
  );
}
