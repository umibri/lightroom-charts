import { describe, expect, it } from 'vitest';
import {
  addMonths,
  apexToFNumber,
  apexToSeconds,
  isMonth,
  isoBin,
  ISO_BINS,
  monthOf,
  monthsBetween,
  presetRange,
  zeroFillMonths,
} from './transforms.ts';

describe('month math', () => {
  it('validates YYYY-MM', () => {
    expect(isMonth('2025-01')).toBe(true);
    expect(isMonth('2025-12')).toBe(true);
    expect(isMonth('2025-13')).toBe(false);
    expect(isMonth('2025-00')).toBe(false);
    expect(isMonth('2025-1')).toBe(false);
  });

  it('adds months across year boundaries', () => {
    expect(addMonths('2025-01', -1)).toBe('2024-12');
    expect(addMonths('2024-12', 1)).toBe('2025-01');
    expect(addMonths('2025-03', -23)).toBe('2023-04');
    expect(addMonths('2025-03', 0)).toBe('2025-03');
  });

  it('throws on invalid input instead of producing garbage', () => {
    expect(() => addMonths('March', 1)).toThrow(RangeError);
  });

  it('uses the local calendar month', () => {
    expect(monthOf(new Date(2026, 0, 31, 23, 59))).toBe('2026-01');
  });

  it('lists months inclusively, empty when reversed', () => {
    expect(monthsBetween('2024-11', '2025-02')).toEqual([
      '2024-11',
      '2024-12',
      '2025-01',
      '2025-02',
    ]);
    expect(monthsBetween('2025-02', '2025-02')).toEqual(['2025-02']);
    expect(monthsBetween('2025-03', '2025-02')).toEqual([]);
  });
});

describe('zeroFillMonths', () => {
  it('fills gaps, drops out-of-range rows, sums duplicates', () => {
    const rows = [
      { month: '2024-12', count: 2 },
      { month: '2025-02', count: 5 },
      { month: '2025-02', count: 1 },
      { month: '2023-01', count: 99 },
    ];
    expect(zeroFillMonths(rows, '2024-12', '2025-03')).toEqual([
      { month: '2024-12', count: 2 },
      { month: '2025-01', count: 0 },
      { month: '2025-02', count: 6 },
      { month: '2025-03', count: 0 },
    ]);
  });

  it('returns all zeros for an empty result', () => {
    expect(zeroFillMonths([], '2025-01', '2025-02').map((r) => r.count)).toEqual([0, 0]);
  });
});

describe('presetRange', () => {
  const extent = { first: '2019-06', last: '2025-01' };

  it('12/24 months end at (and include) the current month', () => {
    expect(presetRange('12m', '2026-11', extent)).toEqual({ from: '2025-12', to: '2026-11' });
    expect(presetRange('24m', '2026-11', extent)).toEqual({ from: '2024-12', to: '2026-11' });
    expect(monthsBetween('2024-12', '2026-11')).toHaveLength(24);
  });

  it('all spans the catalog extent, or null when nothing is dated', () => {
    expect(presetRange('all', '2026-11', extent)).toEqual({ from: '2019-06', to: '2025-01' });
    expect(presetRange('all', '2026-11', null)).toBeNull();
  });
});

describe('isoBin', () => {
  const label = (iso: number) => ISO_BINS[isoBin(iso)].label;

  it('puts full stops in their own bin', () => {
    expect(label(100)).toBe('≤100');
    expect(label(800)).toBe('800');
    expect(label(6400)).toBe('6400');
  });

  it('rounds third-stops up and clamps the ends', () => {
    expect(label(64)).toBe('≤100');
    expect(label(125)).toBe('200');
    expect(label(250)).toBe('400');
    expect(label(320)).toBe('400');
    expect(label(12800)).toBe('12800+');
    expect(label(102400)).toBe('12800+');
  });
});

describe('APEX conversions', () => {
  it('aperture value → f-number', () => {
    expect(apexToFNumber(0)).toBe(1);
    expect(apexToFNumber(2)).toBe(2);
    expect(apexToFNumber(5)).toBeCloseTo(5.66, 2);
  });

  it('shutter value → seconds', () => {
    expect(apexToSeconds(0)).toBe(1);
    expect(apexToSeconds(8)).toBeCloseTo(1 / 256, 6);
    expect(apexToSeconds(-1)).toBe(2);
  });
});
