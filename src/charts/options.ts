import type { EChartsCoreOption } from 'echarts/core';
import { CHART_TEXT_WIDE, type ThemeColors } from './theme.ts';
import type { MonthCount } from '@/catalog/transforms.ts';
import type { NameCount } from '@/catalog/queries.ts';

const size = (c: ThemeColors) => c.text ?? CHART_TEXT_WIDE;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2025-03' → 'Mar 2025' */
export function monthLabel(m: string): string {
  return `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
}

/** '#1d5fd1' + 0.4 → 'rgba(29, 95, 209, 0.4)'. Non-hex colors pass through unchanged. */
export function withAlpha(color: string, a: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  const h = m[1].length === 3 ? [...m[1]].map((x) => x + x).join('') : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Index of the largest value, or -1 when there's nothing worth singling out. */
export function peakIndex(values: number[]): number {
  if (values.length < 2) return -1;
  let best = -1;
  values.forEach((v, i) => {
    if (v > 0 && (best < 0 || v > values[best])) best = i;
  });
  return best;
}

/**
 * One-hue gradient: solid at the value end, fading toward the baseline.
 * `across` runs left→right (horizontal bars); otherwise bottom→top.
 */
function fade(color: string, across: boolean) {
  const solid = { offset: 1, color };
  const faint = { offset: 0, color: withAlpha(color, 0.5) };
  return across
    ? { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [faint, solid] }
    : { type: 'linear', x: 0, y: 1, x2: 0, y2: 0, colorStops: [faint, solid] };
}

const escapeHtml = (t: string) => t.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** Bar styling shared by every chart: gradient fill, highlighted peak, hover glow. */
function barStyle(values: number[], c: ThemeColors, across: boolean) {
  const peak = peakIndex(values);
  const normal = fade(c.chart, across);
  const top = fade(c.chartPeak || c.chart, across);
  const radius = across ? [0, 5, 5, 0] : [5, 5, 0, 0];
  return {
    peak,
    itemStyle: {
      borderRadius: radius,
      color: (p: { dataIndex: number }) => (p.dataIndex === peak ? top : normal),
    },
    emphasis: {
      focus: 'none',
      itemStyle: {
        color: top,
        shadowBlur: 14,
        shadowColor: withAlpha(c.chart, 0.45),
      },
    },
  };
}

/** Value label on the peak bar only (selective labels, not one per bar). */
function peakLabel(peak: number, c: ThemeColors) {
  return {
    show: peak >= 0,
    position: 'top',
    color: c.fg,
    fontWeight: 600,
    fontSize: size(c).base,
    formatter: (p: { dataIndex: number; value: number }) =>
      p.dataIndex === peak ? p.value.toLocaleString() : '',
  };
}

function base(c: ThemeColors) {
  const motion = !c.reducedMotion;
  return {
    // Bars grow in one after another; filter changes glide to the new values.
    animation: motion,
    animationDuration: 700,
    animationEasing: 'cubicOut' as const,
    animationDelay: (i: number) => Math.min(i * 18, 450),
    animationDurationUpdate: 450,
    animationEasingUpdate: 'cubicInOut' as const,
    // Chart text is in px (the root font size doesn't reach the canvas).
    textStyle: { color: c.muted, fontFamily: c.font ?? 'sans-serif', fontSize: size(c).base },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: withAlpha(c.chart, 0.1) } },
      backgroundColor: c.surface,
      borderColor: c.line,
      padding: [8, 12],
      extraCssText: 'border-radius: 10px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);',
      textStyle: { color: c.fg, fontFamily: c.font ?? 'sans-serif', fontSize: size(c).base },
      formatter: (params: { name: string; value: number }[]) => {
        const p = params[0];
        if (!p) return '';
        return (
          `<div style="color:${c.muted}">${escapeHtml(p.name)}</div>` +
          `<div><b style="font-size:1.2em">${p.value.toLocaleString()}</b> ` +
          `photo${p.value === 1 ? '' : 's'}</div>`
        );
      },
    },
  };
}

const valueAxis = (c: ThemeColors) => ({
  type: 'value',
  minInterval: 1,
  axisLabel: { color: c.muted, fontSize: size(c).base },
  splitLine: { lineStyle: { color: c.line, type: [4, 4] } },
});

/** Photos per month, oldest left. */
export function timelineOption(rows: MonthCount[], c: ThemeColors): EChartsCoreOption {
  const values = rows.map((r) => r.count);
  const style = barStyle(values, c, false);
  return {
    ...base(c),
    grid: { left: 8, right: 8, top: 24, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: rows.map((r) => monthLabel(r.month)),
      axisLabel: { color: c.muted, hideOverlap: true, fontSize: size(c).base },
      axisLine: { lineStyle: { color: c.line } },
      axisTick: { show: false },
    },
    yAxis: valueAxis(c),
    series: [
      {
        type: 'bar',
        name: 'Photos',
        data: values,
        ...style,
        label: peakLabel(style.peak, c),
        barMaxWidth: 24,
        // Dashed average across the range: is this month busy or quiet?
        markLine:
          values.length > 1
            ? {
                silent: true,
                symbol: 'none',
                data: [{ type: 'average', name: 'Average' }],
                lineStyle: { color: c.muted, type: [6, 4], width: 1 },
                label: {
                  position: 'insideEndTop',
                  color: c.muted,
                  // A pill keeps the label readable where it crosses bars.
                  backgroundColor: c.surface,
                  borderColor: c.line,
                  borderWidth: 1,
                  borderRadius: 4,
                  padding: [2, 6],
                  fontSize: size(c).dense,
                  formatter: (p: { value: number }) => `avg ${Math.round(p.value)}`,
                },
              }
            : undefined,
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
  const values = top.map((r) => r.count);
  const style = barStyle(values, c, true);
  return {
    ...base(c),
    grid: { left: 8, right: 40, top: 4, bottom: 4, containLabel: true },
    // Each bar is labelled with its value, so the value axis would only crowd
    // narrow screens.
    xAxis: { ...valueAxis(c), axisLabel: { show: false }, splitLine: { show: false } },
    yAxis: {
      type: 'category',
      data: top.map((r) => r.name),
      axisLabel: { color: c.fg, width: labelWidth, overflow: 'truncate', fontSize: size(c).base },
      axisLine: { lineStyle: { color: c.line } },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        name: 'Photos',
        data: values,
        ...style,
        barMaxWidth: 18,
        // A faint track behind each bar shows how far it is from the leader.
        showBackground: true,
        backgroundStyle: { color: withAlpha(c.line, 0.5), borderRadius: [0, 5, 5, 0] },
        label: {
          show: true,
          position: 'right',
          fontSize: size(c).base,
          color: c.muted,
          // The leader's count is bold and in full ink.
          formatter: (p: { dataIndex: number; value: number }) =>
            p.dataIndex === style.peak
              ? `{peak|${p.value.toLocaleString()}}`
              : p.value.toLocaleString(),
          rich: { peak: { color: c.fg, fontWeight: 600, fontSize: size(c).base } },
        },
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
  const values = bins.map((b) => b.count);
  const style = barStyle(values, c, false);
  return {
    ...base(c),
    grid: { left: 8, right: 8, top: 24, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: bins.map((b) => b.label),
      // Few bins: show every label (ECharts would skip alternate ones on phones).
      // Many bins (24 hours): let ECharts thin labels that would overlap.
      axisLabel: everyLabel
        ? { color: c.muted, interval: 0, fontSize: size(c).dense }
        : { color: c.muted, hideOverlap: true, fontSize: size(c).base },
      axisLine: { lineStyle: { color: c.line } },
      axisTick: { show: false },
    },
    yAxis: valueAxis(c),
    series: [
      {
        type: 'bar',
        name: 'Photos',
        data: values,
        ...style,
        label: peakLabel(style.peak, c),
        barMaxWidth: 24,
      },
    ],
  };
}

/** Number of rows to give a ranking chart enough height per bar. */
export function rankingHeight(n: number): number {
  return Math.max(140, 34 * Math.max(n, 1) + 28);
}
