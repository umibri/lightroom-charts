import { useMemo, type ReactNode } from 'react';
import EChart from '@/charts/EChart';
import DataTable from '@/charts/DataTable';
import { columnOption, rankingHeight, rankingOption } from '@/charts/options.ts';
import type { ThemeColors } from '@/charts/theme.ts';

export function Card({
  title,
  note,
  wide,
  children,
}: {
  title: string;
  note?: string;
  /** Span both columns of the chart grid. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-line p-4 ${wide ? 'lg:col-span-2' : ''}`}>
      {/* Titles stay on one line; a long note wraps below instead of squeezing it. */}
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="font-medium whitespace-nowrap">{title}</h2>
        {note && <span className="text-xs text-muted">{note}</span>}
      </div>
      {children}
    </section>
  );
}

export function Status({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted">{children}</p>;
}

type Shape = 'columns' | 'many-columns' | 'bars';

/**
 * A card with one bar chart of ordered bins plus its "Show data" table.
 * 'columns' shows every label; 'many-columns' lets labels thin out (24 hours);
 * 'bars' is horizontal, for long labels, first bin at the top.
 */
export function BinsCard({
  title,
  note,
  wide,
  bins,
  unknown,
  shape,
  colors,
  labelWidth,
  caption,
  binName,
}: {
  title: string;
  note?: string;
  wide?: boolean;
  bins: { label: string; count: number }[] | undefined;
  /** Shown as a final "Unknown" table row when provided. */
  unknown?: number;
  shape: Shape;
  colors: ThemeColors;
  labelWidth: number;
  /** Table caption and chart label prefix, e.g. "Aperture, Jan 2024 – Dec 2024". */
  caption: string;
  /** First table column header, e.g. "Aperture". */
  binName: string;
}) {
  const option = useMemo(() => {
    if (!bins) return null;
    if (shape === 'bars') {
      return rankingOption(
        bins.map((b) => ({ name: b.label, count: b.count })),
        colors,
        labelWidth
      );
    }
    return columnOption(bins, colors, { everyLabel: shape === 'columns' });
  }, [bins, shape, colors, labelWidth]);

  return (
    <Card title={title} note={note} wide={wide}>
      {option && bins ? (
        <EChart
          option={option}
          height={shape === 'bars' ? rankingHeight(bins.length) : 220}
          label={`${caption}: ${bins.map((b) => `${b.label} ${b.count}`).join(', ')}`}
        />
      ) : (
        <Status>Loading…</Status>
      )}
      {bins && (
        <DataTable
          caption={caption}
          columns={[binName, 'Photos']}
          rows={[
            ...bins.map((b): [string, number] => [b.label, b.count]),
            ...(unknown !== undefined ? [['Unknown', unknown] as [string, number]] : []),
          ]}
        />
      )}
    </Card>
  );
}
