import { test, expect } from '@playwright/test';
import { forceEnglishLocale } from './helpers/auth';
import { deleteEventById, seedEvent } from './helpers/api';

const EVENT_ID = '6a9af01451cf57d0be8bb40b'; // Jazz & Wine

test.describe('Payments & finance', () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('loads payments workspace with KPIs charts and tables', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_ID}/payments`);
    await expect(page.getByRole('heading', { name: /Payments & finance/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /Download report/i })).toBeVisible();
    await expect(page.getByRole('region', { name: /Finance summary/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Gross total/i)).toBeVisible();
    await expect(page.getByText(/Producer net/i)).toBeVisible();
    await expect(page.getByRole('region', { name: /Finance charts/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Daily sales/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Transactions$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Settlements$/i })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await expect(page.locator('body')).not.toContainText('Cannot GET /api');
  });

  test('search filters transactions and can clear', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_ID}/payments`);
    const search = page.getByPlaceholder(/Search transactions/i);
    await expect(search).toBeVisible({ timeout: 20_000 });
    await search.fill('zzzz-no-match');
    await expect(page.getByText(/No transactions match/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Clear search/i }).click();
    await expect(search).toHaveValue('');
    await expect(page.getByText(/No transactions match/i)).toHaveCount(0);
  });

  test('download report shows success message', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_ID}/payments`);
    await expect(page.getByRole('button', { name: /Download report/i })).toBeVisible({
      timeout: 20_000,
    });
    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 }).catch(() => null);
    await page.getByRole('button', { name: /Download report/i }).click();
    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/payments-report-/i);
    }
    await expect(page.getByText(/Payments report downloaded/i)).toBeVisible({ timeout: 10_000 });
  });

  test('filters button shows coming soon notice', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_ID}/payments`);
    await expect(page.getByRole('button', { name: /^Filters$/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /^Filters$/i }).click();
    await expect(page.getByText(/available soon/i)).toBeVisible({ timeout: 10_000 });
  });

  test('payments shell loads on freshly seeded draft event', async ({ page }) => {
    const seeded = await seedEvent(`PW Payments ${Date.now()}`);
    try {
      await page.goto(`/admin/events/${seeded.id}/payments`);
      await expect(page.getByRole('heading', { name: /Payments & finance/i })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText(/Gross total/i)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole('button', { name: /Download report/i })).toBeVisible();
    } finally {
      await deleteEventById(seeded.id);
    }
  });
});
