import type { Summary } from '@/catalog/queries.ts';
import { monthLabel } from '@/charts/options.ts';

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-line px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-xl font-semibold tabular-nums">{value}</dd>
      {note && <dd className="mt-0.5 truncate text-xs text-muted">{note}</dd>}
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
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
