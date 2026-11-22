import { useEffect, useState } from 'react';

// The parent remounts this (key = URL range) when the URL changes from outside,
// e.g. back/forward, so local input state never goes stale.
import { isMonth, type Month } from '@/catalog/transforms.ts';
import type { RangeKey, StatsSearch } from '@/catalog/filters.ts';

const PRESETS: { key: RangeKey; label: string }[] = [
  { key: '12m', label: '12 months' },
  { key: '24m', label: '24 months' },
  { key: 'all', label: 'All' },
  { key: 'custom', label: 'Custom' },
];

const DEBOUNCE_MS = 400;

interface Props {
  search: StatsSearch;
  /** The range currently shown, used to seed the custom inputs. */
  resolved: { from: Month; to: Month } | null;
  onChange: (next: StatsSearch) => void;
}

export default function DateFilter({ search, resolved, onChange }: Props) {
  const [from, setFrom] = useState(search.from ?? resolved?.from ?? '');
  const [to, setTo] = useState(search.to ?? resolved?.to ?? '');
  const custom = search.range === 'custom';

  // Commit custom edits once typing settles: one URL change, one query.
  useEffect(() => {
    if (!custom || !isMonth(from) || !isMonth(to)) return;
    if (from === search.from && to === search.to) return;
    const t = setTimeout(() => onChange({ range: 'custom', from, to }), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [custom, from, to, search.from, search.to, onChange]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        role="group"
        aria-label="Date range"
        className="flex rounded-lg border border-line p-0.5"
      >
        {PRESETS.map((p) => {
          const active = search.range === p.key;
          return (
            <button
              key={p.key}
              type="button"
              aria-pressed={active}
              className={`rounded-md px-3 py-1 text-sm sm:px-4 sm:py-1.5 sm:text-base ${
                active ? 'bg-fg text-bg' : 'text-muted hover:text-fg'
              }`}
              onClick={() => {
                if (p.key !== 'custom') return onChange({ range: p.key });
                const f = isMonth(from) ? from : resolved?.from;
                const t = isMonth(to) ? to : resolved?.to;
                if (f && t) onChange({ range: 'custom', from: f, to: t });
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {custom && (
        <div className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-1">
            <span className="text-muted">From</span>
            <input
              type="month"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-line bg-bg px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-muted">To</span>
            <input
              type="month"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-line bg-bg px-2 py-1"
            />
          </label>
        </div>
      )}
    </div>
  );
}
