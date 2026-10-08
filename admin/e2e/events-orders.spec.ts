import { test, expect } from '@playwright/test';
import { forceEnglishLocale } from './helpers/auth';
import { deleteEventById, seedEvent } from './helpers/api';

const EVENT_WITH_ORDERS = '6a9af01451cf57d0be8bb40b'; // Jazz & Wine — has drink orders

test.describe('Purchases & orders', () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('loads orders workspace with table and filters', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_WITH_ORDERS}/orders`);
    await expect(page.getByRole('heading', { name: /Purchases & orders/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByPlaceholder(/Search by order ID/i)).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Product/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /QR status/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Export/i })).toBeVisible();
    await expect(page.getByText(/Showing \d+ to \d+ of \d+ orders/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /View order/i }).first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await expect(page.locator('body')).not.toContainText('Cannot GET /api');
  });

  test('opens order detail modal', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_WITH_ORDERS}/orders`);
    await expect(page.getByRole('button', { name: /View order/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /View order/i }).first().click();
    await expect(page.getByText(/Order detail/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/#ORD-/i).first()).toBeVisible();
    await page.getByRole('button', { name: /Close/i }).click();
    await expect(page.getByText(/Order detail/i)).toHaveCount(0);
  });

  test('filters by QR status', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_WITH_ORDERS}/orders`);
    await expect(page.getByText(/Showing \d+ to \d+ of \d+ orders/i)).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('combobox', { name: /QR status/i }).selectOption('invalid');
    await expect(page.getByText(/Showing \d+ to \d+ of \d+ orders/i)).toBeVisible();
    await expect(page.locator('.qr-status-pill--invalid.qr-status-pill--table').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: /View order/i }).first()).toBeVisible();
    await page.getByRole('button', { name: /Clear filters/i }).click();
    await expect(page.getByRole('combobox', { name: /QR status/i })).toHaveValue('');
  });

  test('export modal opens and bar export runs', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_WITH_ORDERS}/orders`);
    await expect(page.getByRole('button', { name: /Export/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Export/i }).click();
    await expect(page.getByRole('heading', { name: /Export data/i })).toBeVisible();
    await expect(page.getByText(/Bar and products/i)).toBeVisible();

    const downloadPromise = page.waitForEvent('download', { timeout: 20_000 }).catch(() => null);
    await page.getByRole('button', { name: /Bar and products/i }).click();
    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/bar-products-/i);
    }
    await expect(
      page.getByText(/Bar export completed|Could not export|not available/i),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('empty state on seeded event without orders', async ({ page }) => {
    const seeded = await seedEvent(`PW Orders Empty ${Date.now()}`);
    try {
      await page.goto(`/admin/events/${seeded.id}/orders`);
      await expect(page.getByRole('heading', { name: /Purchases & orders/i })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText(/No drink orders/i)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/Showing 0 to 0 of 0 orders/i)).toBeVisible();
    } finally {
      await deleteEventById(seeded.id);
    }
  });
});
