import { describe, expect, it } from 'vitest';
import { parseStatsSearch, resolveRange } from './filters.ts';

describe('parseStatsSearch', () => {
  it('accepts presets', () => {
    expect(parseStatsSearch({ range: '12m' })).toEqual({ range: '12m' });
    expect(parseStatsSearch({ range: 'all' })).toEqual({ range: 'all' });
  });

  it('defaults to 24 months for missing or unknown values', () => {
    expect(parseStatsSearch({})).toEqual({ range: '24m' });
    expect(parseStatsSearch({ range: 'forever' })).toEqual({ range: '24m' });
  });

  it('keeps a valid custom range and drops stray from/to on presets', () => {
    expect(parseStatsSearch({ range: 'custom', from: '2024-01', to: '2024-06' })).toEqual({
      range: 'custom',
      from: '2024-01',
      to: '2024-06',
    });
    expect(parseStatsSearch({ range: '12m', from: '2024-01' })).toEqual({ range: '12m' });
  });

  it('falls back when a custom range is incomplete or malformed', () => {
    expect(parseStatsSearch({ range: 'custom', from: '2024-01' })).toEqual({ range: '24m' });
    expect(parseStatsSearch({ range: 'custom', from: '2024-13', to: '2024-06' })).toEqual({
      range: '24m',
    });
    expect(parseStatsSearch({ range: 'custom', from: 202401, to: '2024-06' })).toEqual({
      range: '24m',
    });
  });
});

describe('resolveRange', () => {
  const extent = { first: '2020-03', last: '2025-08' };

  it('resolves presets relative to today', () => {
    expect(resolveRange({ range: '12m' }, '2026-11', extent)).toEqual({
      from: '2025-12',
      to: '2026-11',
    });
    expect(resolveRange({ range: 'all' }, '2026-11', extent)).toEqual({
      from: '2020-03',
      to: '2025-08',
    });
  });

  it('swaps a backwards custom range', () => {
    expect(
      resolveRange({ range: 'custom', from: '2025-06', to: '2024-01' }, '2026-11', extent)
    ).toEqual({ from: '2024-01', to: '2025-06' });
  });

  it('returns null for All on a catalog with no dated photos', () => {
    expect(resolveRange({ range: 'all' }, '2026-11', null)).toBeNull();
  });
});
