import React from 'react';
import { Link } from '@tanstack/react-router';
import { catalog } from '@/lib/dbClient';
import type { Summary } from '@/catalog/queries.ts';

// Phase 1: plain summary from the tested query layer. Charts arrive in Phase 2.
function StatsRoute() {
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [state, setState] = React.useState<'loading' | 'ready' | 'none'>('loading');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const api = catalog();
      if (!(await api.isOpen())) {
        if (!cancelled) setState('none');
        return;
      }
      const s = await api.summary();
      if (!cancelled) {
        setSummary(s);
        setState('ready');
      }
    })().catch((e: unknown) => {
      console.error(e);
      if (!cancelled) setState('none');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows: [string, string | number][] = summary
    ? [
        ['Photos', summary.photos],
        ['Videos', summary.videos],
        ['Virtual copies (not counted)', summary.virtualCopies],
        ['Without a capture date', summary.undated],
        ['First month', summary.firstMonth ?? '—'],
        ['Last month', summary.lastMonth ?? '—'],
        ['Cameras', summary.cameras],
        ['Lenses', summary.lenses],
      ]
    : [];

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-semibold">Stats</h1>
      {state === 'loading' && <p className="text-muted">Loading…</p>}
      {state === 'none' && (
        <p className="text-muted">
          No catalog is open.{' '}
          <Link to="/load" className="text-accent underline">
            Load a catalog
          </Link>
        </p>
      )}
      {state === 'ready' && (
        <dl className="grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
          {rows.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="text-muted">{k}</dt>
              <dd className="text-right font-mono tabular-nums">{v}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </div>
  );
}

export default StatsRoute;
