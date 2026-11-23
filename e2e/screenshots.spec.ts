// README screenshots from demo data. Opt-in, not part of the normal suite:
//   SCREENSHOTS=1 npx playwright test screenshots --project=desktop
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const OUT = path.resolve(import.meta.dirname, '../docs/screenshots');

test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to regenerate README images');

async function openDemo(page: Page) {
  await page.goto('./#/load');
  await page.getByRole('button', { name: 'Try with sample data' }).click();
  await expect(page.locator('canvas').first()).toBeVisible();
  await page.waitForTimeout(1400); // let staggered bar animations finish
}

for (const scheme of ['light', 'dark'] as const) {
  test(`stats, desktop, ${scheme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 1000 });
    await page.emulateMedia({ colorScheme: scheme });
    await openDemo(page);
    await page.screenshot({ path: path.join(OUT, `stats-desktop-${scheme}.png`) });
  });
}

test('stats, phone, dark', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await openDemo(page);
  await page.screenshot({ path: path.join(OUT, 'stats-phone-dark.png') });
});

test('load, desktop, light', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 700 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./#/load');
  await page.screenshot({ path: path.join(OUT, 'load-desktop-light.png') });
});
