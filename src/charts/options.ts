import type { EChartsCoreOption } from 'echarts/core';
import type { ThemeColors } from './theme.ts';
import type { MonthCount } from '@/catalog/transforms.ts';
import type { NameCount } from '@/catalog/queries.ts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2025-03' → 'Mar 2025' */
export function monthLabel(m: string): string {
  return `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
}

function base(c: ThemeColors) {
  return {
    animationDuration: 300,
    textStyle: { color: c.muted, fontFamily: 'inherit' },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: c.surface,
      borderColor: c.line,
      textStyle: { color: c.fg },
    },
  };
}

const valueAxis = (c: ThemeColors) => ({
  type: 'value',
  minInterval: 1,
  axisLabel: { color: c.muted },
  splitLine: { lineStyle: { color: c.line } },
});

/** Photos per month, oldest left. */
export function timelineOption(rows: MonthCount[], c: ThemeColors): EChartsCoreOption {
  return {
    ...base(c),
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: rows.map((r) => monthLabel(r.month)),
      axisLabel: { color: c.muted, hideOverlap: true },
      axisLine: { lineStyle: { color: c.line } },
      axisTick: { show: false },
    },
    yAxis: valueAxis(c),
    series: [
      {
        type: 'bar',
        name: 'Photos',
        data: rows.map((r) => r.count),
        itemStyle: { color: c.chart, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 24,
      },
    ],
  };
}

/**
 * Horizontal bars, first row at the top. Used for rankings (rows sorted by
 * count) and for ordered bins with long labels (shutter speed, focal length).
 * Long names are truncated on the axis.
 */
export function rankingOption(
  rows: NameCount[],
  c: ThemeColors,
  labelWidth: number
): EChartsCoreOption {
  const top = [...rows].reverse();
  return {
    ...base(c),
    grid: { left: 8, right: 40, top: 4, bottom: 4, containLabel: true },
    // Each bar is labelled with its value, so the value axis would only crowd
    // narrow screens.
    xAxis: { ...valueAxis(c), axisLabel: { show: false }, splitLine: { show: false } },
    yAxis: {
      type: 'category',
      data: top.map((r) => r.name),
      axisLabel: { color: c.fg, width: labelWidth, overflow: 'truncate' },
      axisLine: { lineStyle: { color: c.line } },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        name: 'Photos',
        data: top.map((r) => r.count),
        itemStyle: { color: c.chart, borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 18,
        label: { show: true, position: 'right', color: c.muted },
      },
    ],
  };
}

/** Vertical columns for ordered bins (ISO, aperture, shutter, focal length, hours, weekdays). */
export function columnOption(
  bins: { label: string; count: number }[],
  c: ThemeColors,
  { everyLabel = true }: { everyLabel?: boolean } = {}
): EChartsCoreOption {
  return {
    ...base(c),
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: bins.map((b) => b.label),
      // Few bins: show every label (ECharts would skip alternate ones on phones).
      // Many bins (24 hours): let ECharts thin labels that would overlap.
      axisLabel: everyLabel
        ? { color: c.muted, interval: 0, fontSize: 11 }
        : { color: c.muted, hideOverlap: true, fontSize: 11 },
      axisLine: { lineStyle: { color: c.line } },
      axisTick: { show: false },
    },
    yAxis: valueAxis(c),
    series: [
      {
        type: 'bar',
        name: 'Photos',
        data: bins.map((b) => b.count),
        itemStyle: { color: c.chart, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 24,
      },
    ],
  };
}

/** Number of rows to give a ranking chart enough height per bar. */
export function rankingHeight(n: number): number {
  return Math.max(120, 28 * Math.max(n, 1) + 24);
}
