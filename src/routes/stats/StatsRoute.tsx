import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { catalog } from '@/lib/dbClient';
import { useOpenCatalog } from '@/state/catalogStore';
import { resolveRange, type StatsSearch } from '@/catalog/filters.ts';
import { HOURS, monthOf, WEEKDAYS } from '@/catalog/transforms.ts';
import EChart from '@/charts/EChart';
import { CHART_TEXT_NARROW, CHART_TEXT_WIDE, useThemeColors } from '@/charts/theme.ts';
import { monthLabel, rankingHeight, rankingOption, timelineOption } from '@/charts/options.ts';
import DateFilter from './DateFilter';
import { BinsCard, Card, Status } from './Card';
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

export default function StatsRoute() {
  const open = useOpenCatalog()!; // guaranteed by the route's beforeLoad
  const search = useSearch({ from: '/stats' });
  const navigate = useNavigate({ from: '/stats' });
  const themeColors = useThemeColors();
  const wide = useWide();
  // Theme colors plus chart text sizes for this screen width.
  const colors = useMemo(
    () => ({ ...themeColors, text: wide ? CHART_TEXT_WIDE : CHART_TEXT_NARROW }),
    [themeColors, wide]
  );

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

  const exposure = useQuery({
    queryKey: ['exposure', ...key],
    queryFn: () => catalog().exposure(range),
    enabled,
  });
  const timeOfWeek = useQuery({
    queryKey: ['timeOfWeek', ...key],
    queryFn: () => catalog().timeOfWeek(range),
    enabled,
  });
  const videos = useQuery({
    queryKey: ['videos', ...key],
    queryFn: () => catalog().videoCount(range),
    enabled,
  });
  // Shown on the gear/ISO charts, which count stills only.
  const videoNote = videos.data ? `${videos.data.toLocaleString()} videos not included` : null;
  const unknownNote = (n: number | undefined) => (n ? `${n.toLocaleString()} unknown` : null);
  const joinNotes = (...parts: (string | null | undefined)[]) =>
    parts.filter(Boolean).join(' · ') || undefined;

  const total = timeline.data?.reduce((n, r) => n + r.count, 0);
  const empty = total === 0;
  const labelWidth = wide ? 200 : 125;

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

  const rangeText = range ? `${monthLabel(range.from)} – ${monthLabel(range.to)}` : 'No dates';
  const failed = [timeline, lenses, cameras, iso, exposure, timeOfWeek].some((q) => q.isError);

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
              <BinsCard
                title="ISO"
                note={joinNotes(unknownNote(iso.data?.unknown), videoNote)}
                bins={iso.data?.bins}
                unknown={iso.data?.unknown}
                shape="columns"
                colors={colors}
                labelWidth={labelWidth}
                caption={`ISO, ${rangeText}`}
                binName="ISO"
              />
              <BinsCard
                title="Aperture"
                note={joinNotes(
                  'nearest full stop',
                  unknownNote(exposure.data?.aperture.unknown),
                  videoNote
                )}
                bins={exposure.data?.aperture.bins}
                unknown={exposure.data?.aperture.unknown}
                shape="columns"
                colors={colors}
                labelWidth={labelWidth}
                caption={`Aperture, ${rangeText}`}
                binName="Aperture"
              />
              <BinsCard
                title="Shutter speed"
                note={joinNotes(unknownNote(exposure.data?.shutter.unknown), videoNote)}
                bins={exposure.data?.shutter.bins}
                unknown={exposure.data?.shutter.unknown}
                shape="bars"
                colors={colors}
                labelWidth={labelWidth}
                caption={`Shutter speed, ${rangeText}`}
                binName="Shutter speed"
              />
              <BinsCard
                title="Focal length"
                note={joinNotes(
                  'mm as recorded',
                  unknownNote(exposure.data?.focal.unknown),
                  videoNote
                )}
                bins={exposure.data?.focal.bins}
                unknown={exposure.data?.focal.unknown}
                shape="bars"
                colors={colors}
                labelWidth={labelWidth}
                caption={`Focal length in mm, ${rangeText}`}
                binName="Focal length (mm)"
              />
              <BinsCard
                title="Time of day"
                note="hour the photo was taken, local time"
                wide
                bins={timeOfWeek.data?.hours.map((count, h) => ({ label: HOURS[h], count }))}
                shape="many-columns"
                colors={colors}
                labelWidth={labelWidth}
                caption={`Photos by hour of day, ${rangeText}`}
                binName="Hour"
              />
              <BinsCard
                title="Day of week"
                bins={timeOfWeek.data?.weekdays.map((count, d) => ({ label: WEEKDAYS[d], count }))}
                shape="columns"
                colors={colors}
                labelWidth={labelWidth}
                caption={`Photos by day of week, ${rangeText}`}
                binName="Day"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
