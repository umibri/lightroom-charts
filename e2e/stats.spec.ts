import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { FIXTURES, type Expected } from './paths.ts';

const expected = (): Expected => JSON.parse(readFileSync(FIXTURES.expected, 'utf8'));
const fmt = (n: number) => n.toLocaleString('en-US');

async function load(page: Page, file: string) {
  await page.goto('./#/load');
  await page.locator('input[type=file]').setInputFiles(file);
}

/** The "Photos per month" card's note, e.g. "Dec 2024 – Nov 2026 · 2,348". */
const timelineNote = (page: Page) =>
  page
    .locator('section', { has: page.getByRole('heading', { name: 'Photos per month' }) })
    .locator('.text-xs');

test('stats without a catalog redirects to Load with an explanation', async ({ page }) => {
  await page.goto('./#/stats?range=12m');
  await expect(page).toHaveURL(/#\/load\?from=stats$/);
  await expect(page.getByText('No catalog is open.')).toBeVisible();
});

test('rejects a renamed non-database and a non-Lightroom database', async ({ page }) => {
  await load(page, FIXTURES.notDb);
  await expect(page.getByText('That file isn’t a catalog')).toBeVisible();
  await page.locator('input[type=file]').setInputFiles(FIXTURES.otherDb);
  await expect(page.getByText('not a Lightroom Classic catalog')).toBeVisible();
  await expect(page).toHaveURL(/#\/load/);
});

test('loads a catalog and shows all four charts with correct totals', async ({ page }) => {
  const e = expected();
  await load(page, FIXTURES.demo);
  await expect(page).toHaveURL(/#\/stats\?range=24m$/);
  await expect(page.getByText(`demo.lrcat · ${fmt(e.photos)} photos`)).toBeVisible();
  await expect(timelineNote(page)).toContainText(`· ${fmt(e.m24)}`);
  for (const name of ['Photos per month', 'Lenses', 'Cameras', 'ISO']) {
    const card = page.locator('section', { has: page.getByRole('heading', { name }) });
    await expect(card.locator('canvas')).toBeVisible();
  }
  // No horizontal scrolling at either viewport.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('presets and custom range update the charts; typing is debounced', async ({ page }) => {
  const e = expected();
  await load(page, FIXTURES.demo);
  const group = page.getByRole('group', { name: 'Date range' });

  await group.getByRole('button', { name: '12 months' }).click();
  await expect(page).toHaveURL(/range=12m/);
  await expect(timelineNote(page)).toContainText(`· ${fmt(e.m12)}`);

  await group.getByRole('button', { name: 'All' }).click();
  await expect(timelineNote(page)).toContainText(`· ${fmt(e.all)}`);

  await group.getByRole('button', { name: 'Custom' }).click();
  await expect(page).toHaveURL(/range=custom&from=\d{4}-\d{2}&to=\d{4}-\d{2}/);

  // Count URL commits while editing quickly: only the settled value should land.
  await page.evaluate(() => {
    const w = window as unknown as { __commits: string[] };
    w.__commits = [];
    const orig = history.replaceState.bind(history);
    history.replaceState = (s, t, url) => {
      w.__commits.push(String(url));
      orig(s, t, url);
    };
  });
  const from = page.getByLabel('From', { exact: true });
  for (const v of ['2019-01', '2019-02', '2019-03']) await from.fill(v);
  await page.getByLabel('To', { exact: true }).fill('2019-04');
  await expect(page).toHaveURL(/from=2019-03&to=2019-04/);
  const commits = await page.evaluate(
    () => (window as unknown as { __commits: string[] }).__commits
  );
  expect(commits).toHaveLength(1);
  await expect(page.getByText('No photos in this date range')).toBeVisible();
});

test('captures chart screenshots for review', async ({ page }, info) => {
  await load(page, FIXTURES.demo);
  for (const name of ['Photos per month', 'Lenses', 'ISO']) {
    const card = page.locator('section', { has: page.getByRole('heading', { name }) });
    await card.locator('canvas').waitFor();
    await page.waitForTimeout(400); // let the bar animation finish
    await card.screenshot({ path: info.outputPath(`${name.replace(/\s+/g, '-')}.png`) });
  }
});
