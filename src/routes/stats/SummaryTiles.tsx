import type { Summary } from '@/catalog/queries.ts';
import { monthLabel } from '@/charts/options.ts';

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line px-4 py-3 sm:px-5 sm:py-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 truncate text-2xl font-semibold tabular-nums sm:text-3xl">{value}</dd>
      {note && <dd className="mt-1 truncate text-sm text-muted">{note}</dd>}
    </div>
  );
}

/** Whole-catalog headline numbers (not affected by the date filter). */
export default function SummaryTiles({ summary }: { summary: Summary }) {
  const n = (x: number) => x.toLocaleString();
  const first = summary.firstMonth;
  const last = summary.lastMonth;
  const extras = [
    summary.videos ? `incl. ${n(summary.videos)} videos` : null,
    summary.undated ? `${n(summary.undated)} undated` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section aria-label="Whole catalog">
      <dl className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Tile label="Photos" value={n(summary.photos)} note={extras || undefined} />
        <Tile
          label="Date span"
          value={first ? monthLabel(first) : 'No dates'}
          note={last ? `to ${monthLabel(last)}` : undefined}
        />
        <Tile label="Cameras" value={n(summary.cameras)} />
        <Tile label="Lenses" value={n(summary.lenses)} />
      </dl>
    </section>
  );
}
