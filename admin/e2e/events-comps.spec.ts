import { test, expect } from '@playwright/test';
import { forceEnglishLocale } from './helpers/auth';
import { deleteEventById, seedEvent } from './helpers/api';

const EVENT_ID = '6a9af01351cf57d0be8bb407'; // URBAN NIGHT LIVE — YouPass Events producer

test.describe('Complimentary', () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('loads complimentary workspace with actions and empty table', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_ID}/comps`);
    await expect(page.getByRole('heading', { name: /^Complimentary$/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /Create complimentary/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Create batch/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Frequent clients/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Search by code/i)).toBeVisible();
    await expect(page.getByText(/Showing \d+ to \d+ of \d+ complimentary/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /^General/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^VIP/i }).first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await expect(page.locator('body')).not.toContainText('Cannot GET /api');
  });

  test('opens create complimentary modal', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_ID}/comps`);
    await expect(page.getByRole('button', { name: /Create complimentary/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /Create complimentary/i }).first().click();
    await expect(page.getByRole('heading', { name: /^Create complimentary$/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Beneficiary name/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Beneficiary phone/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Complimentary type/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Included benefits/i })).toBeVisible();
    await page.getByRole('button', { name: /^Cancel$/i }).click();
    await expect(page.getByRole('heading', { name: /^Create complimentary$/i })).toHaveCount(0);
  });

  test('opens create batch and filters modals', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_ID}/comps`);
    await expect(page.getByRole('button', { name: /Create batch/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /Create batch/i }).first().click();
    await expect(page.getByRole('heading', { name: /Create complimentary batch/i })).toBeVisible();
    await page.getByRole('button', { name: /Cancel|Close/i }).first().click();
    await expect(page.getByRole('heading', { name: /Create complimentary batch/i })).toHaveCount(0);

    await page.getByRole('button', { name: /^Filters$/i }).click();
    await expect(page.getByRole('heading', { name: /Filter complimentary/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: /Close|Cancel|Apply/i }).first().click();
  });

  test('create complimentary then invalidate', async ({ page }) => {
    const stamp = Date.now().toString().slice(-8);
    const name = `PW Comp ${stamp.slice(-6)}`;
    const phone = `9${stamp}`;
    const today = new Date().toISOString().slice(0, 10);

    await page.goto(`/admin/events/${EVENT_ID}/comps`);
    await expect(page.getByRole('button', { name: /Create complimentary/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /Create complimentary/i }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /^Create complimentary$/i })).toBeVisible();
    await dialog.getByRole('textbox', { name: /Beneficiary name/i }).fill(name);
    await dialog.getByRole('textbox', { name: /Beneficiary phone/i }).fill(phone);
    await dialog.getByRole('combobox', { name: /Complimentary type/i }).selectOption('general');
    await dialog.getByRole('textbox', { name: /Included benefits/i }).fill('Entry + welcome drink');
    await dialog.getByLabel(/Issue date/i).fill(today);
    await dialog.getByRole('button', { name: /^Create complimentary$/i }).click();

    await expect(page.getByText(/Complimentary perk created successfully/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });

    const row = page.getByRole('row', { name: new RegExp(name, 'i') });
    page.once('dialog', (confirm) => confirm.accept());
    await row.getByRole('button', { name: /^Delete$/i }).click();
    await expect(page.getByText(/invalidated/i)).toBeVisible({ timeout: 15_000 });
  });

  test('empty complimentary shell on freshly seeded draft event', async ({ page }) => {
    const seeded = await seedEvent(`PW Comps Empty ${Date.now()}`);
    try {
      await page.goto(`/admin/events/${seeded.id}/comps`);
      await expect(page.getByRole('heading', { name: /^Complimentary$/i })).toBeVisible({
        timeout: 20_000,
      });
      await expect(
        page.getByText(/Showing 0 to 0 of 0 complimentary|No complimentary/i).first(),
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole('button', { name: /Create complimentary/i }).first()).toBeVisible();
    } finally {
      await deleteEventById(seeded.id);
    }
  });
});
