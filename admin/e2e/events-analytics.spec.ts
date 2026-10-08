import { test, expect } from '@playwright/test';
import { forceEnglishLocale } from './helpers/auth';
import { deleteEventById, seedEvent } from './helpers/api';

const FINISHED_EVENT = '6a9af01451cf57d0be8bb40b'; // Jazz & Wine
const EVENT_WITH_SALES = '6a9af059f9b1891b4a84c731'; // New Year Gala

test.describe('Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('loads analytics workspace with KPIs and export actions', async ({ page }) => {
    await page.goto(`/admin/events/${FINISHED_EVENT}/analytics`);
    await expect(page.getByRole('heading', { name: /^Analytics$/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /Export PDF/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Export Excel/i })).toBeVisible();
    await expect(page.getByText(/Total sales/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Unique users/i)).toBeVisible();
    await expect(page.getByText(/Sell-through/i)).toBeVisible();
    // Finished events default to all-time (not empty "Today")
    await expect(page.getByRole('button', { name: /Sales period/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Main charts/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Sales per hour/i })).toBeVisible();
    await expect(page.getByText(/General|Piscolas|VIP/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /User behavior/i })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('switches sales period filter', async ({ page }) => {
    await page.goto(`/admin/events/${FINISHED_EVENT}/analytics`);
    await expect(page.getByRole('button', { name: /Sales period/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /Sales period/i }).click();
    await expect(page.getByRole('option', { name: /Last 7 days/i })).toBeVisible();
    await page.getByRole('option', { name: /Last 7 days/i }).click();
    await expect(page.getByRole('button', { name: /Sales period/i })).toContainText(/Last 7 days/i);
    await expect(page.getByText(/Total sales/i)).toBeVisible();

    await page.getByRole('button', { name: /Sales period/i }).click();
    await page.getByRole('option', { name: /All time/i }).click();
    await expect(page.getByRole('button', { name: /Sales period/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Main charts/i })).toBeVisible();
  });

  test('export modal opens from Export Excel and downloads full report', async ({ page }) => {
    await page.goto(`/admin/events/${FINISHED_EVENT}/analytics`);
    await expect(page.getByText(/Total sales/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Export Excel/i })).toBeVisible();
    await page.getByRole('button', { name: /Export Excel/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /Export report/i })).toBeVisible();
    await expect(dialog.getByText(/Full report/i)).toBeVisible();

    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 }).catch(() => null);
    await dialog.getByRole('button', { name: /Full report/i }).click();
    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/analytics-.*-full\.csv/i);
    }
    await expect(page.getByText(/Report downloaded|not ready/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Export report/i })).toHaveCount(0);
  });

  test('export PDF modal opens', async ({ page }) => {
    await page.goto(`/admin/events/${FINISHED_EVENT}/analytics`);
    await expect(page.getByRole('button', { name: /Export PDF/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /Export PDF/i }).click();
    await expect(page.getByRole('heading', { name: /Export report/i })).toBeVisible();
    await expect(page.getByText(/Sales per hour/i).first()).toBeVisible();
    await page.getByRole('button', { name: /Close|Cancel/i }).first().click();
    await expect(page.getByRole('heading', { name: /Export report/i })).toHaveCount(0);
  });

  test('loads analytics for event with sales activity', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_WITH_SALES}/analytics`);
    await expect(page.getByRole('heading', { name: /^Analytics$/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Total sales|Unique users|Sell-through/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('shows analytics shell on freshly seeded draft event', async ({ page }) => {
    const seeded = await seedEvent(`PW Analytics ${Date.now()}`);
    try {
      await page.goto(`/admin/events/${seeded.id}/analytics`);
      await expect(page.getByRole('heading', { name: /^Analytics$/i })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText(/Total sales/i)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole('heading', { name: /Main charts/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Export Excel/i })).toBeVisible();
    } finally {
      await deleteEventById(seeded.id);
    }
  });
});
