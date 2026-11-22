// The Stats page's date filter, as it appears in the URL (#/stats?range=24m or
// ?range=custom&from=2024-01&to=2024-12), and how it resolves to a month range.
import { isMonth, presetRange, type Month, type Preset } from './transforms.ts';

export type RangeKey = Preset | 'custom';

export interface StatsSearch {
  range: RangeKey;
  from?: Month;
  to?: Month;
}

export const DEFAULT_RANGE: Preset = '24m';
const KEYS: RangeKey[] = ['12m', '24m', 'all', 'custom'];

/** Sanitize untrusted URL params. Bad values fall back to the default. */
export function parseStatsSearch(raw: Record<string, unknown>): StatsSearch {
  const range = KEYS.includes(raw.range as RangeKey) ? (raw.range as RangeKey) : DEFAULT_RANGE;
  if (range !== 'custom') return { range };
  const from = typeof raw.from === 'string' && isMonth(raw.from) ? raw.from : undefined;
  const to = typeof raw.to === 'string' && isMonth(raw.to) ? raw.to : undefined;
  if (!from || !to) return { range: DEFAULT_RANGE };
  return { range, from, to };
}

/**
 * Concrete from..to for queries. Custom ranges given backwards are swapped.
 * Returns null when there is nothing to show ('all' on a catalog with no dated photos).
 */
export function resolveRange(
  search: StatsSearch,
  today: Month,
  extent: { first: Month; last: Month } | null
): { from: Month; to: Month } | null {
  if (search.range === 'custom' && search.from && search.to) {
    return search.from <= search.to
      ? { from: search.from, to: search.to }
      : { from: search.to, to: search.from };
  }
  return presetRange(search.range === 'custom' ? DEFAULT_RANGE : search.range, today, extent);
}
