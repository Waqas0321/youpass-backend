import { test, expect } from '@playwright/test';
import { forceEnglishLocale } from './helpers/auth';
import { deleteEventById, seedEvent } from './helpers/api';

// URBAN NIGHT LIVE — YouPass Events producer with seeded invitations
const EVENT_WITH_INVITES = '6a9af01351cf57d0be8bb407';

test.describe('Event invitations', () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('loads invitations for the event producer (not empty)', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_WITH_INVITES}/invitations`);
    await expect(page.getByRole('heading', { name: /^Invitations$/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /Create invitation/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Create list/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Frequent clients/i })).toBeVisible();
    await expect(page.getByText(/Showing \d+ to \d+ of \d+ guests/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Admin Email QA Guest|List QA Guest/i).first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('guest list chips and search render', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_WITH_INVITES}/invitations`);
    await expect(page.getByRole('heading', { name: /^Invitations$/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /Influencers/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /VIP guests/i })).toBeVisible();
    const search = page.getByPlaceholder(/Search guest by name/i);
    await search.fill('Admin');
    await expect(search).toHaveValue('Admin');
    await expect(page.getByText(/Admin Email QA Guest/i)).toBeVisible({ timeout: 10_000 });
  });

  test('opens create invitation modal', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_WITH_INVITES}/invitations`);
    await expect(page.getByRole('button', { name: /Create invitation/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /Create invitation/i }).first().click();
    await expect(page.getByRole('heading', { name: /^Create invitation$/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Full name/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Phone number/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /List assignment/i })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Invitation type/i })).toBeVisible();
    await page.getByRole('button', { name: /^Cancel$/i }).click();
    await expect(page.getByRole('heading', { name: /^Create invitation$/i })).toHaveCount(0);
  });

  test('opens create list and filters modals', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_WITH_INVITES}/invitations`);
    await expect(page.getByRole('button', { name: /Create list/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /Create list/i }).click();
    await expect(page.getByRole('heading', { name: /^Create list$/i })).toBeVisible();
    await page.getByRole('button', { name: /Cancel|Close/i }).first().click();
    await expect(page.getByRole('heading', { name: /^Create list$/i })).toHaveCount(0);

    await page.getByRole('button', { name: /^Filters$/i }).click();
    await expect(
      page.getByRole('heading', { name: /Filters|Filter invitations/i }),
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Close|Cancel|Apply/i }).first().click();
  });

  test('views invitation QR detail', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_WITH_INVITES}/invitations`);
    await expect(page.getByRole('button', { name: /View QR/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /View QR/i }).first().click();
    await expect(page.getByText(/Admin Email QA Guest|List QA Guest/i).first()).toBeVisible();
    await page.getByRole('button', { name: /Close/i }).first().click();
  });

  test('create invitation then revoke', async ({ page }) => {
    const stamp = Date.now().toString().slice(-8);
    const name = `PW Invite ${stamp.slice(-6)}`;
    const phone = `9${stamp}`;

    await page.goto(`/admin/events/${EVENT_WITH_INVITES}/invitations`);
    await expect(page.getByRole('button', { name: /Create invitation/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /Create invitation/i }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /^Create invitation$/i })).toBeVisible();
    await dialog.getByRole('textbox', { name: /Full name/i }).fill(name);
    await dialog.getByRole('textbox', { name: /Phone number/i }).fill(phone);
    await dialog.getByRole('combobox', { name: /List assignment/i }).selectOption('Influencers');
    await dialog.getByRole('combobox', { name: /Invitation type/i }).selectOption('general');
    await dialog.getByRole('button', { name: /^Create invitation$/i }).click();

    await expect(page.getByText(/Invitation sent successfully/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });

    const row = page.getByRole('row', { name: new RegExp(name, 'i') });
    page.once('dialog', (confirm) => confirm.accept());
    await row.getByRole('button', { name: /^Delete$/i }).click();
    await expect(page.getByText(/Invitation revoked/i)).toBeVisible({ timeout: 15_000 });
  });

  test('empty invitations on freshly seeded draft event', async ({ page }) => {
    const seeded = await seedEvent(`PW Invites Empty ${Date.now()}`);
    try {
      await page.goto(`/admin/events/${seeded.id}/invitations`);
      await expect(page.getByRole('heading', { name: /^Invitations$/i })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText(/Showing 0 to 0 of 0 guests|No guests/i).first()).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByRole('button', { name: /Create invitation/i }).first()).toBeVisible();
    } finally {
      await deleteEventById(seeded.id);
    }
  });
});
