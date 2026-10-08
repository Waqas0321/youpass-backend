import { test, expect } from '@playwright/test';
import { forceEnglishLocale } from './helpers/auth';
import { deleteEventById, seedEvent } from './helpers/api';

const JAZZ_WINE_ID = '6a9af01451cf57d0be8bb40b';

test.describe('Event information', () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('loads existing event info with required fields', async ({ page }) => {
    const title = `PW Info ${Date.now()}`;
    const seeded = await seedEvent(title);

    try {
      await page.goto(`/admin/events/${seeded.id}/info`);
      await expect(page.getByRole('heading', { name: /Event information/i })).toBeVisible();
      await expect(page.getByRole('textbox', { name: /Event name/i })).toHaveValue(title);
      await expect(page.getByRole('textbox', { name: /Venue/i })).toHaveValue(/Playwright Venue/i);
      await expect(page.getByRole('button', { name: /Save changes/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Publish event/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /Basic information/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /Multimedia/i })).toBeVisible();
    } finally {
      await deleteEventById(seeded.id);
    }
  });

  test('edit description and save', async ({ page }) => {
    const title = `PW InfoEdit ${Date.now()}`;
    const seeded = await seedEvent(title);
    const nextDescription = `Updated description ${Date.now()}`;

    try {
      await page.goto(`/admin/events/${seeded.id}/info`);
      await expect(page.getByRole('textbox', { name: /Event name/i })).toHaveValue(title);

      await page.getByRole('textbox', { name: /Event description/i }).fill(nextDescription);
      await page.getByRole('button', { name: /Save changes/i }).click();
      await expect(page.getByText('Changes saved successfully.')).toBeVisible({ timeout: 20_000 });

      await page.reload();
      await expect(page.getByRole('textbox', { name: /Event description/i })).toHaveValue(nextDescription);
    } finally {
      await deleteEventById(seeded.id);
    }
  });

  test('new event form shows draft workspace chrome', async ({ page }) => {
    await page.goto('/admin/events/new/info');
    await expect(page.getByRole('heading', { name: /Event information/i })).toBeVisible();
    await expect(page.getByText(/New event|DRAFT/i).first()).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Event name/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Publish event/i })).toBeVisible();
  });

  test('keeps orphan event type (bar) selectable', async ({ page }) => {
    // Jazz & Wine is seeded with event_type slug "bar", which is not in /events/types.
    await page.goto(`/admin/events/${JAZZ_WINE_ID}/info`);
    const category = page.getByRole('combobox', { name: /Category/i });
    await expect(category).toHaveValue('bar');
    await expect(category.locator('option[value="bar"]')).toHaveText(/Bar/i);
  });

  test('Jazz & Wine shows published actions and app preview', async ({ page }) => {
    await page.goto(`/admin/events/${JAZZ_WINE_ID}/info`);
    await expect(page.getByRole('textbox', { name: /Event name/i })).toHaveValue(/Jazz & Wine/i);
    await expect(page.getByRole('button', { name: /Unpublish/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Save changes/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /App preview/i })).toBeVisible();

    await page.getByRole('button', { name: /App preview/i }).click();
    await expect(page.getByRole('heading', { name: /App preview/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Jazz & Wine/i })).toBeVisible();
    await page.getByRole('button', { name: /Close/i }).click();
  });

  test('sidebar event card updates live while editing title', async ({ page }) => {
    const title = `PW LivePreview ${Date.now()}`;
    const seeded = await seedEvent(title);

    try {
      await page.goto(`/admin/events/${seeded.id}/info`);
      await expect(page.getByRole('textbox', { name: /Event name/i })).toHaveValue(title);

      const nextTitle = `${title} LIVE`;
      await page.getByRole('textbox', { name: /Event name/i }).fill(nextTitle);

      // Sidebar card should reflect draft title before save
      await expect(page.locator('.event-workspace__event-card strong')).toHaveText(nextTitle);
    } finally {
      await deleteEventById(seeded.id);
    }
  });
});
