import { describe, expect, it } from 'vitest';
import {
  columnOption,
  monthLabel,
  rankingHeight,
  rankingOption,
  timelineOption,
  peakIndex,
  withAlpha,
} from './options.ts';

const colors = {
  fg: '#000',
  muted: '#555',
  line: '#ddd',
  accent: '#00f',
  chart: '#00f',
  surface: '#eee',
};

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
    const o = columnOption(
      [
        { label: '≤100', count: 1 },
        { label: '200', count: 2 },
      ],
      colors
    ) as unknown as Opt;
    expect(o.xAxis.data).toEqual(['≤100', '200']);
  });

  it('ranking height grows with rows and has a floor', () => {
    expect(rankingHeight(0)).toBe(140);
    expect(rankingHeight(15)).toBe(34 * 15 + 28);
  });
});

describe('column labels', () => {
  type Axis = { xAxis: { axisLabel: { interval?: number; hideOverlap?: boolean } } };
  it('shows every label by default, thins labels when asked (24 hours)', () => {
    const bins = [{ label: '00', count: 1 }];
    const all = columnOption(bins, colors) as unknown as Axis;
    expect(all.xAxis.axisLabel.interval).toBe(0);
    const thin = columnOption(bins, colors, { everyLabel: false }) as unknown as Axis;
    expect(thin.xAxis.axisLabel.interval).toBeUndefined();
    expect(thin.xAxis.axisLabel.hideOverlap).toBe(true);
  });
});

describe('chart text sizes', () => {
  type T = { textStyle: { fontSize: number }; xAxis: { axisLabel: { fontSize: number } } };
  const bins = [{ label: 'f/2.8', count: 1 }];
  it('defaults to the wide sizes and follows a narrow override', () => {
    const wide = columnOption(bins, colors) as unknown as T;
    expect(wide.textStyle.fontSize).toBe(14);
    expect(wide.xAxis.axisLabel.fontSize).toBe(13); // dense: every label shown
    const narrow = columnOption(bins, { ...colors, text: { base: 14, dense: 12 } }) as unknown as T;
    expect(narrow.textStyle.fontSize).toBe(14);
    expect(narrow.xAxis.axisLabel.fontSize).toBe(12);
  });
});

describe('chart font family', () => {
  type T = { textStyle: { fontFamily: string } };
  it('uses a concrete font family, never a CSS keyword like inherit', () => {
    const o = columnOption([{ label: 'a', count: 1 }], colors) as unknown as T;
    expect(o.textStyle.fontFamily).toBe('sans-serif');
    const withFont = columnOption([{ label: 'a', count: 1 }], {
      ...colors,
      font: 'system-ui, sans-serif',
    }) as unknown as T;
    expect(withFont.textStyle.fontFamily).toBe('system-ui, sans-serif');
    expect(withFont.textStyle.fontFamily).not.toMatch(/inherit|initial|unset/);
  });
});

describe('chart polish helpers', () => {
  it('adds alpha to hex colors and passes others through', () => {
    expect(withAlpha('#1d5fd1', 0.5)).toBe('rgba(29, 95, 209, 0.5)');
    expect(withAlpha('#fff', 1)).toBe('rgba(255, 255, 255, 1)');
    expect(withAlpha('red', 0.5)).toBe('red');
  });

  it('finds the peak bar, ignoring single bars and all-zero data', () => {
    expect(peakIndex([1, 5, 3])).toBe(1);
    expect(peakIndex([4, 4])).toBe(0);
    expect(peakIndex([7])).toBe(-1);
    expect(peakIndex([0, 0])).toBe(-1);
  });

  it('timeline gets an average line; a single month does not', () => {
    type M = { series: { markLine?: unknown }[] };
    const two = timelineOption(
      [
        { month: '2024-01', count: 1 },
        { month: '2024-02', count: 3 },
      ],
      colors
    ) as unknown as M;
    expect(two.series[0].markLine).toBeDefined();
    const one = timelineOption([{ month: '2024-01', count: 1 }], colors) as unknown as M;
    expect(one.series[0].markLine).toBeUndefined();
  });

  it('turns animation off for reduced motion', () => {
    type A = { animation: boolean };
    const bins = [{ label: 'a', count: 1 }];
    expect((columnOption(bins, colors) as unknown as A).animation).toBe(true);
    expect((columnOption(bins, { ...colors, reducedMotion: true }) as unknown as A).animation).toBe(
      false
    );
  });

  it('escapes names in the tooltip', () => {
    type T = { tooltip: { formatter: (p: { name: string; value: number }[]) => string } };
    const o = columnOption([{ label: 'a', count: 1 }], colors) as unknown as T;
    const html = o.tooltip.formatter([{ name: '<img src=x>', value: 2 }]);
    expect(html).not.toContain('<img');
    expect(html).toContain('2</b> photos');
  });
});
