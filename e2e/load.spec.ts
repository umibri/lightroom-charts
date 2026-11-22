import { expect, test, type Page } from '@playwright/test';
import { FIXTURES } from './paths.ts';

const alert = (page: Page) => page.getByRole('alert');

/** Drop a synthetic file on an element (or the page body) via a real DragEvent. */
async function dropFile(page: Page, selector: string, name: string, size?: number) {
  await page.evaluate(
    ([sel, fileName, fakeSize]) => {
      const f = new File(['x'], fileName as string);
      if (fakeSize) Object.defineProperty(f, 'size', { value: fakeSize });
      const dt = new DataTransfer();
      dt.items.add(f);
      const target = document.querySelector(sel as string)!;
      for (const type of ['dragenter', 'dragover', 'drop']) {
        target.dispatchEvent(
          new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true })
        );
      }
    },
    [selector, name, size ?? 0] as const
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('./#/load');
});

test('explains privacy and how to find the catalog', async ({ page }) => {
  await expect(page.getByText('Nothing is uploaded.')).toBeVisible();
  await expect(page.getByText('Close Lightroom first')).toBeVisible();
});

test('wrong file type names the file; choosing it again still responds', async ({ page }) => {
  const input = page.locator('input[type=file]');
  await input.setInputFiles(FIXTURES.text);
  await expect(alert(page)).toContainText('That’s not a Lightroom catalog');
  await expect(alert(page)).toContainText('You chose “notes.txt”');
  // The input is reset after each pick, so the same file triggers a change again.
  await expect(input).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Choose another file' })).toBeVisible();
});

test('dropping a file anywhere on the page is handled, not opened by the browser', async ({
  page,
}) => {
  await dropFile(page, 'header', 'holiday.jpg');
  await expect(alert(page)).toContainText('That’s not a Lightroom catalog');
  await expect(page).toHaveURL(/#\/load/);
});

test('large catalogs ask before opening; Cancel returns to idle', async ({ page }) => {
  await dropFile(page, 'main', 'Huge.lrcat', 2 * 1024 ** 3);
  await expect(alert(page)).toContainText('This catalog is 2,048 MB');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(alert(page)).toHaveCount(0);
});

test('the file chooser is reachable by keyboard', async ({ page }) => {
  const input = page.locator('input[type=file]');
  for (let i = 0; i < 10 && !(await input.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(input).toBeFocused();
});

test('demo mode opens sample data with a visible badge', async ({ page }) => {
  await page.getByRole('button', { name: 'Try with sample data' }).click();
  await expect(page).toHaveURL(/#\/stats\?range=24m/);
  await expect(page.getByText('Demo data')).toBeVisible();
  await expect(page.getByText('Demo catalog', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Whole catalog' })).toContainText('3,000');
  await page.getByRole('button', { name: '12 months' }).click();
  await expect(page).toHaveURL(/range=12m/);
  // Gear and ISO charts count stills only and say how many videos they leave out.
  for (const name of ['Lenses', 'Cameras', 'ISO']) {
    const card = page.locator('section', { has: page.getByRole('heading', { name }) });
    await expect(card).toContainText(/\d+ videos not included/);
  }
});

test('every chart has a data table with the same rows', async ({ page }) => {
  await page.getByRole('button', { name: 'Try with sample data' }).click();
  const lenses = page.locator('section', { has: page.getByRole('heading', { name: 'Lenses' }) });
  await lenses.getByText('Show data').click();
  const rows = lenses.locator('tbody tr');
  await expect(rows.first()).toBeVisible();
  const n = await rows.count();
  expect(n).toBeGreaterThan(1);
  expect(n).toBeLessThanOrEqual(15);
  const label = await lenses.getByRole('img').getAttribute('aria-label');
  const firstLens = (await rows.first().locator('td').first().innerText()).trim();
  expect(label).toContain(firstLens);

  const timeline = page.locator('section', {
    has: page.getByRole('heading', { name: 'Photos per month' }),
  });
  await timeline.getByText('Show data').click();
  await expect(timeline.locator('tbody tr')).toHaveCount(24);
});
