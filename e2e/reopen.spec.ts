// "Reopen last catalog" (Chromium only). Playwright can't drive the native
// showOpenFilePicker dialog, so these tests create a real FileSystemFileHandle
// in the origin-private file system (OPFS), where read permission is already
// granted, and store it exactly as the app does after a successful open.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { FIXTURES } from './paths.ts';

const NAME = 'My Catalog.lrcat';

/** Put the demo catalog in OPFS and remember its handle like saveRecent() does. */
async function rememberOpfsCatalog(page: Page, savedAt = Date.now()) {
  const b64 = readFileSync(FIXTURES.demo).toString('base64');
  await page.evaluate(
    async ([data, name, at]) => {
      const bytes = Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0));
      const dir = await navigator.storage.getDirectory();
      const handle = await dir.getFileHandle(name as string, { create: true });
      const w = await handle.createWritable();
      await w.write(bytes);
      await w.close();
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('lightroom-charts', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const tx = req.result.transaction('kv', 'readwrite');
          tx.objectStore('kv').put({ handle, name, savedAt: at }, 'recent-catalog');
          tx.oncomplete = () => {
            req.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    },
    [b64, NAME, savedAt] as const
  );
}

const recentCard = (page: Page) => page.getByRole('region', { name: 'Recent catalog' });

test.beforeEach(async ({ page }) => {
  await page.goto('./#/load');
});

test('no remembered catalog: no Reopen card', async ({ page }) => {
  await expect(page.getByText('Open a Lightroom catalog')).toBeVisible();
  await expect(recentCard(page)).toHaveCount(0);
});

test('Reopen opens the remembered catalog straight into Stats', async ({ page }) => {
  await rememberOpfsCatalog(page, Date.now() - 24 * 60 * 60 * 1000);
  await page.reload();
  await expect(recentCard(page)).toContainText(NAME);
  await expect(recentCard(page)).toContainText('remembered in this browser only');
  await recentCard(page).getByRole('button', { name: 'Reopen' }).click();
  await expect(page).toHaveURL(/#\/stats\?range=24m/);
  await expect(page.getByText(NAME)).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible();
});

test('after a reload on Stats, Load points to Reopen', async ({ page }) => {
  await rememberOpfsCatalog(page);
  // What a user does: be on Stats, then reload (the catalog in memory is gone).
  await page.goto('./#/stats?range=24m');
  await page.reload();
  await expect(page).toHaveURL(/from=stats/);
  await expect(page.getByText('use Reopen below')).toBeVisible();
  await expect(recentCard(page)).toBeVisible();
});

test('Forget removes the card and it stays gone after a reload', async ({ page }) => {
  await rememberOpfsCatalog(page);
  await page.reload();
  await recentCard(page).getByRole('button', { name: 'Forget' }).click();
  await expect(recentCard(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Open a Lightroom catalog')).toBeVisible();
  await expect(recentCard(page)).toHaveCount(0);
});

test('a catalog that has since been deleted is reported and forgotten', async ({ page }) => {
  await rememberOpfsCatalog(page);
  await page.evaluate(async (name) => {
    const dir = await navigator.storage.getDirectory();
    await dir.removeEntry(name);
  }, NAME);
  await page.reload();
  await recentCard(page).getByRole('button', { name: 'Reopen' }).click();
  await expect(page.getByText(`“${NAME}” is no longer there`)).toBeVisible();
  await expect(recentCard(page)).toHaveCount(0);
  await page.reload();
  await expect(recentCard(page)).toHaveCount(0);
});
