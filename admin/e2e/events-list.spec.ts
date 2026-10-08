import { test, expect } from '@playwright/test';
import { forceEnglishLocale } from './helpers/auth';
import { deleteEventById, seedEvent } from './helpers/api';

test.describe('Events list', () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('loads events page and shows create CTA', async ({ page }) => {
    await page.goto('/admin/events');
    await expect(page.getByRole('heading', { name: /^Events$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create event/i }).first()).toBeVisible();
  });

  test('seeded event appears in list and can be searched', async ({ page }) => {
    const title = `PW Seed ${Date.now()}`;
    const seeded = await seedEvent(title);
    try {
      await page.goto('/admin/events');
      await page.getByPlaceholder(/Search event/i).fill(title);
      const card = page.locator('article.events-list-card', { hasText: title });
      await expect(card).toBeVisible();
    } finally {
      await deleteEventById(seeded.id);
    }
  });

  test('lifecycle filter tabs are clickable', async ({ page }) => {
    await page.goto('/admin/events');
    const tablist = page.getByRole('tablist');
    for (const name of ['All', 'Active', 'Upcoming', 'Finished', 'Drafts']) {
      await tablist.getByRole('tab', { name: new RegExp(`^${name}\\b`, 'i') }).click();
    }
    await expect(tablist.getByRole('tab', { name: /^All\b/i })).toBeVisible();
  });
});
