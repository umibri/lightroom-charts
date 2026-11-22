import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextThemePref, readThemePref } from './theme';

describe('theme preference', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cycles Auto → Light → Dark → Auto', () => {
    expect(nextThemePref('system')).toBe('light');
    expect(nextThemePref('light')).toBe('dark');
    expect(nextThemePref('dark')).toBe('system');
  });

  it('reads a saved light/dark choice', () => {
    vi.stubGlobal('localStorage', { getItem: () => 'dark' });
    expect(readThemePref()).toBe('dark');
  });

  it('treats missing or unknown values as system', () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    expect(readThemePref()).toBe('system');
    vi.stubGlobal('localStorage', { getItem: () => 'purple' });
    expect(readThemePref()).toBe('system');
  });

  it('falls back to system when storage throws (private mode, blocked)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
    });
    expect(readThemePref()).toBe('system');
  });
});
