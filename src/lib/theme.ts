export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'theme';
const ORDER: ThemePref[] = ['system', 'light', 'dark'];

/** Read the saved preference. Storage can be unavailable (private mode, blocked). */
export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

/** Apply to <html data-theme> and persist. 'system' removes the override. */
export function applyThemePref(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* preference just won't persist */
  }
}

export function nextThemePref(pref: ThemePref): ThemePref {
  return ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
}
