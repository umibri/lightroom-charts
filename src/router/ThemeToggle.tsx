import { useState } from 'react';
import { applyThemePref, nextThemePref, readThemePref, type ThemePref } from '@/lib/theme';

const LABEL: Record<ThemePref, string> = { system: 'Auto', light: 'Light', dark: 'Dark' };

/** Cycles Auto (follow OS) → Light → Dark. */
export default function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>(readThemePref);

  return (
    <button
      type="button"
      className="rounded-md border border-line px-2 py-0.5 text-muted hover:text-fg"
      aria-label={`Theme: ${LABEL[pref]}. Click to change.`}
      title="Theme: Auto follows your system setting"
      onClick={() => {
        const next = nextThemePref(pref);
        applyThemePref(next);
        setPref(next);
      }}
    >
      {LABEL[pref]}
    </button>
  );
}
