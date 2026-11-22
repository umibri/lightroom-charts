import { describe, expect, it } from 'vitest';
import { isoOption, monthLabel, rankingHeight, rankingOption, timelineOption } from './options.ts';

const colors = { fg: '#000', muted: '#555', line: '#ddd', accent: '#00f', surface: '#eee' };

// The option objects are loosely typed; read the bits we assert on.
type Opt = {
  xAxis: { data?: string[] };
  yAxis: { data?: string[] };
  series: { data: number[] }[];
};

describe('chart options', () => {
  it('formats month labels', () => {
    expect(monthLabel('2025-03')).toBe('Mar 2025');
    expect(monthLabel('1999-12')).toBe('Dec 1999');
  });

  it('timeline keeps month order and counts, including zeros', () => {
    const o = timelineOption(
      [
        { month: '2024-12', count: 3 },
        { month: '2025-01', count: 0 },
      ],
      colors
    ) as unknown as Opt;
    expect(o.xAxis.data).toEqual(['Dec 2024', 'Jan 2025']);
    expect(o.series[0].data).toEqual([3, 0]);
  });

  it('ranking puts the largest at the top (last in a category y-axis)', () => {
    const o = rankingOption(
      [
        { name: 'A', count: 9 },
        { name: 'B', count: 4 },
      ],
      colors,
      120
    ) as unknown as Opt;
    expect(o.yAxis.data).toEqual(['B', 'A']);
    expect(o.series[0].data).toEqual([4, 9]);
  });

  it('ISO bins stay low to high', () => {
    const o = isoOption(
      [
        { label: '≤100', count: 1 },
        { label: '200', count: 2 },
      ],
      colors
    ) as unknown as Opt;
    expect(o.xAxis.data).toEqual(['≤100', '200']);
  });

  it('ranking height grows with rows and has a floor', () => {
    expect(rankingHeight(0)).toBe(120);
    expect(rankingHeight(15)).toBe(28 * 15 + 24);
  });
});
