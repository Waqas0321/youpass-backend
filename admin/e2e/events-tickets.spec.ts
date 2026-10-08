import { test, expect } from '@playwright/test';
import { forceEnglishLocale } from './helpers/auth';
import { deleteEventById, seedEvent } from './helpers/api';

const EVENT_WITH_TICKETS = '6a9af01451cf57d0be8bb40b'; // Jazz & Wine

test.describe('Event tickets', () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('loads ticket offerings for event', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_WITH_TICKETS}/tickets`);
    await expect(page.getByRole('heading', { name: /^Tickets$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create ticket/i })).toBeVisible();
    await expect(page.getByText(/Showing \d+ to \d+ of \d+ tickets/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Early Bird|General|VIP|Pre-sale|Preventa/i).first()).toBeVisible();
  });

  test('disables create when all ticket categories are used', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_WITH_TICKETS}/tickets`);
    await expect(page.getByText(/Showing \d+ to \d+ of \d+ tickets/i)).toBeVisible({
      timeout: 20_000,
    });
    const createBtn = page.getByRole('button', { name: /Create ticket/i }).first();
    await expect(createBtn).toBeDisabled();
    await expect(page.getByText(/one ticket per category/i)).toBeVisible();
  });

  test('create, edit, pause, and delete a ticket on a fresh event', async ({ page }) => {
    const seeded = await seedEvent(`E2E Tickets ${Date.now()}`);
    try {
      await page.goto(`/admin/events/${seeded.id}/tickets`);
      await expect(page.getByRole('heading', { name: /^Tickets$/i })).toBeVisible();
      await expect(page.getByText(/No tickets yet/i)).toBeVisible({ timeout: 20_000 });

      await page.getByRole('button', { name: /Create ticket/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: /Create ticket/i })).toBeVisible();

      await dialog.getByPlaceholder(/Pre-sale|VIP General/i).fill('E2E Early Bird');
      await dialog.locator('input[type="number"]').first().fill('15000');
      await dialog.locator('input[type="number"]').nth(1).fill('50');
      await dialog.locator('select').selectOption('early_bird');
      await dialog.getByRole('button', { name: /^Create ticket$/i }).click();

      await expect(page.getByText(/Ticket created successfully/i)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('E2E Early Bird')).toBeVisible();
      await expect(page.getByText(/CLP|\$15/i).first()).toBeVisible();

      await page.getByRole('button', { name: /^Edit$/i }).first().click();
      const editDialog = page.getByRole('dialog');
      await expect(editDialog.getByRole('heading', { name: /Edit ticket/i })).toBeVisible();
      await editDialog.getByPlaceholder(/Pre-sale|VIP General/i).fill('E2E Early Bird Updated');
      await editDialog.getByRole('button', { name: /Save changes/i }).click();
      await expect(page.getByText(/Ticket updated successfully/i)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('E2E Early Bird Updated')).toBeVisible();

      page.once('dialog', (d) => d.accept());
      await page.getByRole('button', { name: /^Pause$/i }).first().click();
      await expect(page.getByText(/Ticket sales paused/i)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/PAUSED/i).first()).toBeVisible();

      page.once('dialog', (d) => d.accept());
      await page.getByRole('button', { name: /^Delete$/i }).first().click();
      await expect(page.getByText(/Ticket deleted/i)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/No tickets yet/i)).toBeVisible();
    } finally {
      await deleteEventById(seeded.id);
    }
  });
});
