import { test, expect } from '@playwright/test';
import { forceEnglishLocale } from './helpers/auth';
import { createVipZone, deleteEventById, seedEvent } from './helpers/api';

const EVENT_WITH_TABLES = '6a9af01451cf57d0be8bb40b'; // Jazz & Wine

test.describe('VIP tables', () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('loads VIP tables workspace with existing tables', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_WITH_TABLES}/vip-tables`);
    await expect(page.getByRole('heading', { name: /VIP tables/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /Create table/i })).toBeVisible();
    await expect(page.getByText(/Showing \d+ to \d+ of \d+ tables/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Edit table/i }).first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await expect(page.locator('body')).not.toContainText('Cannot GET /api');
  });

  test('shows setup gate when event has no zones', async ({ page }) => {
    const seeded = await seedEvent(`PW VIP Gate ${Date.now()}`);
    try {
      await page.goto(`/admin/events/${seeded.id}/vip-tables`);
      await expect(page.getByRole('heading', { name: /Set up zones first/i })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByRole('link', { name: /Go to Event map/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Quick setup/i })).toBeVisible();
    } finally {
      await deleteEventById(seeded.id);
    }
  });

  test('create, edit, reserve, and release a VIP table', async ({ page }) => {
    const seeded = await seedEvent(`PW VIP CRUD ${Date.now()}`);
    const tableNumber = '7';
    const zoneName = `VIP E2E ${Date.now().toString().slice(-4)}`;

    try {
      // Zone only — do not call ensure-layout (that seeds a full default table map).
      await createVipZone(seeded.id, zoneName);

      await page.goto(`/admin/events/${seeded.id}/vip-tables`);
      await expect(
        page.getByRole('button', { name: /Create table|Create first table/i }),
      ).toBeVisible({ timeout: 20_000 });

      await page.getByRole('button', { name: /Create table|Create first table/i }).first().click();
      const createDialog = page.getByRole('dialog');
      await expect(createDialog.getByRole('heading', { name: /Create table/i })).toBeVisible();
      await createDialog.locator('input[type="number"]').nth(0).fill(tableNumber);
      await createDialog.locator('select').selectOption({ label: zoneName });
      await createDialog.locator('input[type="number"]').nth(1).fill('10');
      await createDialog.locator('input[type="number"]').nth(2).fill('250000');
      await createDialog.getByRole('button', { name: /^Create table$/i }).click();

      await expect(page.getByText(/VIP table created successfully/i)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('row', { name: new RegExp(`^${tableNumber}\\s+${zoneName}`) })).toBeVisible();

      await page.getByRole('button', { name: /Edit table/i }).first().click();
      const editDialog = page.getByRole('dialog');
      await expect(editDialog.getByRole('heading', { name: /Edit table/i })).toBeVisible();
      await editDialog.locator('input[type="number"]').nth(1).fill('12');
      await editDialog.getByRole('button', { name: /Save changes/i }).click();
      await expect(page.getByText(/VIP table updated successfully/i)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/12 people/i)).toBeVisible();

      await page.getByRole('button', { name: /^Reserve$/i }).first().click();
      await expect(page.getByText(/Table reserved/i)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/RESERVED/i).first()).toBeVisible();

      await page.getByRole('button', { name: /^Release$/i }).first().click();
      await expect(page.getByText(/Table released/i)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/AVAILABLE/i).first()).toBeVisible();
    } finally {
      await deleteEventById(seeded.id);
    }
  });

  test('quick setup creates default zones and tables', async ({ page }) => {
    const seeded = await seedEvent(`PW VIP Quick ${Date.now()}`);
    try {
      await page.goto(`/admin/events/${seeded.id}/vip-tables`);
      await expect(page.getByRole('button', { name: /Quick setup/i })).toBeVisible({
        timeout: 20_000,
      });
      await page.getByRole('button', { name: /Quick setup/i }).click();
      await expect(page.getByRole('button', { name: /Create table/i })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText(/Showing \d+ to \d+ of \d+ tables/i)).toBeVisible();
      await expect(page.getByText(/VIP DJ/i).first()).toBeVisible();
    } finally {
      await deleteEventById(seeded.id);
    }
  });
});
