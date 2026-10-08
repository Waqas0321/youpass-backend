import { test, expect } from '@playwright/test';
import { forceEnglishLocale } from './helpers/auth';
import { deleteEventById, listEvents, seedEvent } from './helpers/api';

async function fillRequiredEventInfo(page: import('@playwright/test').Page, title: string) {
  await expect(page.getByRole('textbox', { name: /Event name/i })).toBeVisible();
  // Wait for category options so we don't race the eventTypes bootstrap.
  await expect(page.getByRole('combobox', { name: /Category/i })).toBeVisible();
  await expect(page.getByRole('combobox', { name: /Category/i }).locator('option').nth(1)).toBeAttached({
    timeout: 15_000,
  });

  await page.getByRole('textbox', { name: /Event name/i }).fill(title);
  await page.getByRole('textbox', { name: /Event description/i }).fill(
    'Playwright E2E description for event CRUD coverage.',
  );

  const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const yyyy = start.getFullYear();
  const mm = String(start.getMonth() + 1).padStart(2, '0');
  const dd = String(start.getDate()).padStart(2, '0');
  await page.locator('input[type="date"]').first().fill(`${yyyy}-${mm}-${dd}`);
  await page.locator('input[type="time"]').nth(0).fill('22:00');
  await page.locator('input[type="time"]').nth(1).fill('05:00');

  await page.getByRole('textbox', { name: /Venue/i }).fill('PW Test Venue');
  await page.getByRole('textbox', { name: /Address/i }).fill('Av. Providencia 123, Santiago');
}

function eventCard(page: import('@playwright/test').Page, title: string) {
  return page.locator('article.events-list-card', { hasText: title }).first();
}

test.describe('Events CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('create event via UI (draft)', async ({ page }) => {
    const title = `PW Create ${Date.now()}`;
    await page.goto('/admin/events');
    await page.getByRole('button', { name: /Create event/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/events\/new\/info/);

    await fillRequiredEventInfo(page, title);
    await page.getByRole('button', { name: /Save changes/i }).click();

    await expect(page).toHaveURL(/\/admin\/events\/(?!new)[^/]+\/info/, { timeout: 30_000 });
    await expect(page.getByText('Changes saved successfully.').first()).toBeVisible({ timeout: 20_000 });

    const created = (await listEvents()).find((e) => e.title === title);
    expect(created).toBeTruthy();
    if (created) await deleteEventById(created.id);
  });

  test('update event title via UI', async ({ page }) => {
    const original = `PW Update ${Date.now()}`;
    const seeded = await seedEvent(original);
    const updated = `${original} EDITED`;

    try {
      await page.goto(`/admin/events/${seeded.id}/info`);
      await page.getByPlaceholder('YouFest Caribe Night').fill(updated);
      await page.getByRole('button', { name: /Save changes/i }).click();
      await expect(page.getByText('Changes saved successfully.').first()).toBeVisible({ timeout: 20_000 });

      await page.goto('/admin/events');
      await page.getByPlaceholder(/Search event/i).fill(updated);
      await expect(eventCard(page, updated)).toBeVisible();
    } finally {
      await deleteEventById(seeded.id);
    }
  });

  test('publish and unpublish from event info', async ({ page }) => {
    const title = `PW Publish ${Date.now()}`;
    const seeded = await seedEvent(title);

    try {
      await page.goto(`/admin/events/${seeded.id}/info`);
      await expect(page.getByRole('textbox', { name: /Event name/i })).toHaveValue(title);
      await expect(page.locator('input[type="date"]').first()).not.toHaveValue('');

      await page.getByRole('button', { name: /Publish event/i }).click();
      await expect(page.getByText('Event published successfully.')).toBeVisible({ timeout: 20_000 });

      await page.getByRole('button', { name: /Unpublish/i }).click();
      await expect(page.getByText('Event moved back to draft.')).toBeVisible({ timeout: 20_000 });
    } finally {
      await deleteEventById(seeded.id);
    }
  });


  test('publish from list more-actions menu', async ({ page }) => {
    const title = `PW ListPub ${Date.now()}`;
    const seeded = await seedEvent(title);

    try {
      await page.goto('/admin/events');
      await page.getByPlaceholder(/Search event/i).fill(title);
      const card = eventCard(page, title);
      await expect(card).toBeVisible();

      await card.locator('details.events-list-card__menu').evaluate((el) => {
        (el as HTMLDetailsElement).open = true;
      });
      await card.getByRole('button', { name: /^Publish$/i }).click();
      await expect(page.getByText('Event published to the app.')).toBeVisible({ timeout: 20_000 });
    } finally {
      await deleteEventById(seeded.id);
    }
  });


  test('delete event from list menu', async ({ page }) => {
    const title = `PW Delete ${Date.now()}`;
    await seedEvent(title);

    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.goto('/admin/events');
    await page.getByPlaceholder(/Search event/i).fill(title);
    const card = eventCard(page, title);
    await expect(card).toBeVisible();

    await card.locator('summary[aria-label="More actions"]').click();
    await card.getByRole('button', { name: /^Delete$/i }).click();
    await expect(page.getByText('Event deleted.')).toBeVisible({ timeout: 20_000 });
    await expect(eventCard(page, title)).toHaveCount(0);
  });
});
