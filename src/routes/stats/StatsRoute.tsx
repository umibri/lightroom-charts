import { useCallback, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { catalog } from '@/lib/dbClient';
import { useOpenCatalog } from '@/state/catalogStore';
import { resolveRange, type StatsSearch } from '@/catalog/filters.ts';
import { monthOf } from '@/catalog/transforms.ts';
import EChart from '@/charts/EChart';
import { useThemeColors } from '@/charts/theme.ts';
import {
  isoOption,
  monthLabel,
  rankingHeight,
  rankingOption,
  timelineOption,
} from '@/charts/options.ts';
import DateFilter from './DateFilter';
import DataTable from '@/charts/DataTable';
import SummaryTiles from './SummaryTiles';
import { healthWarnings } from '@/catalog/diagnose.ts';

const WIDE = '(min-width: 640px)';
function useWide(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(WIDE);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(WIDE).matches
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-line p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="font-medium">{title}</h2>
        {note && <span className="text-xs text-muted">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Status({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted">{children}</p>;
}

export default function StatsRoute() {
  const open = useOpenCatalog()!; // guaranteed by the route's beforeLoad
  const search = useSearch({ from: '/stats' });
  const navigate = useNavigate({ from: '/stats' });
  const colors = useThemeColors();
  const wide = useWide();

  const today = monthOf(new Date());
  const { summary, generation } = open;
  const extent =
    summary.firstMonth && summary.lastMonth
      ? { first: summary.firstMonth, last: summary.lastMonth }
      : null;
  const range = resolveRange(search, today, extent);

  const setSearch = useCallback(
    (next: StatsSearch) => navigate({ search: next, replace: true }),
    [navigate]
  );

  const key = [generation, range?.from, range?.to] as const;
  const enabled = range !== null;
  const timeline = useQuery({
    queryKey: ['timeline', ...key],
    queryFn: () => catalog().timeline(range!),
    enabled,
  });
  const lenses = useQuery({
    queryKey: ['lenses', ...key],
    queryFn: () => catalog().topLenses(range),
    enabled,
  });
  const cameras = useQuery({
    queryKey: ['cameras', ...key],
    queryFn: () => catalog().topCameras(range),
    enabled,
  });
  const iso = useQuery({
    queryKey: ['iso', ...key],
    queryFn: () => catalog().isoHistogram(range),
    enabled,
  });

  const videos = useQuery({
    queryKey: ['videos', ...key],
    queryFn: () => catalog().videoCount(range),
    enabled,
  });
  // Shown on the gear/ISO charts, which count stills only.
  const videoNote = videos.data ? `${videos.data.toLocaleString()} videos not included` : null;
  const joinNotes = (...parts: (string | null | undefined)[]) =>
    parts.filter(Boolean).join(' · ') || undefined;

  const total = timeline.data?.reduce((n, r) => n + r.count, 0);
  const empty = total === 0;
  const labelWidth = wide ? 200 : 110;

  const timelineOpt = useMemo(
    () => (timeline.data ? timelineOption(timeline.data, colors) : null),
    [timeline.data, colors]
  );
  const lensOpt = useMemo(
    () => (lenses.data ? rankingOption(lenses.data, colors, labelWidth) : null),
    [lenses.data, colors, labelWidth]
  );
  const cameraOpt = useMemo(
    () => (cameras.data ? rankingOption(cameras.data, colors, labelWidth) : null),
    [cameras.data, colors, labelWidth]
  );
  const isoOpt = useMemo(
    () => (iso.data ? isoOption(iso.data.bins, colors) : null),
    [iso.data, colors]
  );

  const rangeText = range ? `${monthLabel(range.from)} – ${monthLabel(range.to)}` : 'No dates';
  const failed = [timeline, lenses, cameras, iso].some((q) => q.isError);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            Stats
            {open.demo && (
              <span className="rounded-full border border-warn-line bg-warn-bg px-2 py-0.5 text-xs font-medium">
                Demo data
              </span>
            )}
          </h1>
          <p className="truncate text-sm text-muted" title={open.fileName}>
            {open.fileName}
          </p>
        </div>
      </div>

      <SummaryTiles summary={summary} />

      {healthWarnings(open.health).map((w) => (
        <p
          key={w.kind}
          role="alert"
          className="rounded-xl border border-warn-line bg-warn-bg p-3 text-sm"
        >
          <span className="font-medium">
            {Math.round(w.share * 100)}%{' '}
            {w.kind === 'exif'
              ? 'of photos have no camera or lens data we could match.'
              : 'of photos have a capture date we couldn’t read.'}
          </span>{' '}
          {w.kind === 'exif'
            ? 'Camera, lens and ISO charts may be mostly [Unknown].'
            : 'They’re left out of the timeline and date filters.'}{' '}
          This catalog may use a layout the app doesn’t handle yet. Please{' '}
          <a
            href="https://github.com/umibri/lightroom-charts/issues"
            className="underline underline-offset-2"
          >
            report it on GitHub
          </a>
          .
        </p>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <span className="text-sm text-muted">Charts below use this date range</span>
        <DateFilter
          key={`${search.range}:${search.from}:${search.to}`}
          search={search}
          resolved={range}
          onChange={setSearch}
        />
      </div>

      {failed && (
        <p className="rounded-xl border border-danger-line bg-danger-bg p-3 text-sm">
          Some charts couldn’t be loaded. Try loading the catalog again.
        </p>
      )}

      {!range ? (
        <Card title="Photos per month">
          <Status>This catalog has no photos with a capture date.</Status>
        </Card>
      ) : (
        <>
          <Card
            title="Photos per month"
            note={total === undefined ? rangeText : `${rangeText} · ${total.toLocaleString()}`}
          >
            {timelineOpt ? (
              <EChart
                option={timelineOpt}
                height={wide ? 260 : 200}
                label={`Photos per month, ${rangeText}, ${total ?? 0} photos in total`}
              />
            ) : (
              <Status>Loading…</Status>
            )}
            {timeline.data && (
              <DataTable
                caption={`Photos per month, ${rangeText}`}
                columns={['Month', 'Photos']}
                rows={timeline.data.map((r) => [monthLabel(r.month), r.count])}
              />
            )}
          </Card>

          {empty ? (
            <Card title="In this range">
              <Status>No photos in this date range. Try a wider range.</Status>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Lenses" note={joinNotes('Top 15', videoNote)}>
                {lensOpt && lenses.data ? (
                  <EChart
                    option={lensOpt}
                    height={rankingHeight(lenses.data.length)}
                    label={`Top lenses: ${lenses.data.map((r) => `${r.name} ${r.count}`).join(', ')}`}
                  />
                ) : (
                  <Status>Loading…</Status>
                )}
                {lenses.data && (
                  <DataTable
                    caption={`Top lenses, ${rangeText}`}
                    columns={['Lens', 'Photos']}
                    rows={lenses.data.map((r) => [r.name, r.count])}
                  />
                )}
              </Card>
              <Card title="Cameras" note={joinNotes('Top 15', videoNote)}>
                {cameraOpt && cameras.data ? (
                  <EChart
                    option={cameraOpt}
                    height={rankingHeight(cameras.data.length)}
                    label={`Top cameras: ${cameras.data.map((r) => `${r.name} ${r.count}`).join(', ')}`}
                  />
                ) : (
                  <Status>Loading…</Status>
                )}
                {cameras.data && (
                  <DataTable
                    caption={`Top cameras, ${rangeText}`}
                    columns={['Camera', 'Photos']}
                    rows={cameras.data.map((r) => [r.name, r.count])}
                  />
                )}
              </Card>
              <Card
                title="ISO"
                note={joinNotes(
                  iso.data?.unknown ? `${iso.data.unknown.toLocaleString()} unknown` : null,
                  videoNote
                )}
              >
                {isoOpt && iso.data ? (
                  <EChart
                    option={isoOpt}
                    height={220}
                    label={`ISO: ${iso.data.bins.map((b) => `${b.label} ${b.count}`).join(', ')}`}
                  />
                ) : (
                  <Status>Loading…</Status>
                )}
                {iso.data && (
                  <DataTable
                    caption={`ISO, ${rangeText}`}
                    columns={['ISO', 'Photos']}
                    rows={[
                      ...iso.data.bins.map((b): [string, number] => [b.label, b.count]),
                      ['Unknown', iso.data.unknown],
                    ]}
                  />
                )}
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
