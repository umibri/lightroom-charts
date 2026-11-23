import { describe, expect, it } from 'vitest';
import { canRemember, dropHandles, lastOpenedText, loadRecent } from './recentCatalog.ts';

describe('lastOpenedText', () => {
  const now = new Date(2026, 10, 22, 9, 30).getTime(); // 22 Nov 2026, 09:30 local

  it('names recent days by local calendar day, not 24-hour blocks', () => {
    expect(lastOpenedText(new Date(2026, 10, 22, 0, 5).getTime(), now)).toBe('today');
    expect(lastOpenedText(new Date(2026, 10, 21, 23, 59).getTime(), now)).toBe('yesterday');
    expect(lastOpenedText(new Date(2026, 10, 19, 12, 0).getTime(), now)).toBe('3 days ago');
  });

  it('uses a date beyond a week, and "today" for clock skew into the future', () => {
    expect(lastOpenedText(new Date(2026, 9, 1).getTime(), now)).toMatch(/^on .*2026/);
    expect(lastOpenedText(now + 60_000, now)).toBe('today');
  });
});

describe('without the File System Access API (e.g. Firefox, Safari, Node)', () => {
  it('reports the feature as unavailable and remembers nothing', async () => {
    expect(canRemember()).toBe(false);
    expect(await loadRecent()).toBeNull();
    expect(dropHandles(null)).toEqual([]);
  });
});
