import { useEffect, useState } from 'react';

/** Chart text sizes in px (canvas text doesn't follow the page's rem sizes). */
export interface ChartText {
  /** Axis labels, bar values, tooltips. */
  base: number;
  /** Axes that show every label in a narrow slot (ISO, aperture, weekday). */
  dense: number;
}

/** Desktop has room for larger labels; phones keep dense axes small enough not to collide. */
export const CHART_TEXT_WIDE: ChartText = { base: 14, dense: 13 };
export const CHART_TEXT_NARROW: ChartText = { base: 13, dense: 11 };

export interface ThemeColors {
  /** Text sizes; defaults to CHART_TEXT_WIDE when omitted. */
  text?: ChartText;
  /**
   * The page's real font stack. Canvas text needs a concrete family: a CSS
   * keyword like 'inherit' makes the browser ignore the whole font setting
   * and fall back to its small default, whatever size is asked for.
   */
  font?: string;
  fg: string;
  muted: string;
  line: string;
  accent: string;
  /** Mark color for bars (validated per theme). */
  chart: string;
  surface: string;
}

function readColors(): ThemeColors {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    font: getComputedStyle(document.body).fontFamily || 'sans-serif',
    fg: v('--fg'),
    muted: v('--muted'),
    line: v('--line'),
    accent: v('--accent'),
    chart: v('--chart'),
    surface: v('--surface'),
  };
}

/** Current theme colors; updates when the OS scheme or the in-app toggle changes. */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState(readColors);
  useEffect(() => {
    const update = () => setColors(readColors());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', update);
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', update);
      mo.disconnect();
    };
  }, []);
  return colors;
}
