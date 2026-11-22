import { useEffect, useState } from 'react';

export interface ThemeColors {
  fg: string;
  muted: string;
  line: string;
  accent: string;
  surface: string;
}

function readColors(): ThemeColors {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    fg: v('--fg'),
    muted: v('--muted'),
    line: v('--line'),
    accent: v('--accent'),
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
