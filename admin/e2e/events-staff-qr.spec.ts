import { test, expect } from '@playwright/test';
import { forceEnglishLocale } from './helpers/auth';

const EVENT_ID = '6a9af01451cf57d0be8bb40b'; // Jazz & Wine

test.describe('Staff QR', () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('loads staff QR dashboard with roles and staff table', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_ID}/staff-qr`);
    await expect(page.getByRole('heading', { name: /^Staff QR$/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /\+?\s*Add staff/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Available roles/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Team summary/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Active staff/i })).toBeVisible();
    await expect(page.getByText(/Showing \d+ to \d+ of \d+ staff/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /Manage permissions/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Reset QR/i }).first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await expect(page.locator('body')).not.toContainText('Cannot GET /api');
  });

  test('opens add staff modal', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_ID}/staff-qr`);
    await expect(page.getByRole('button', { name: /\+?\s*Add staff/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /\+?\s*Add staff/i }).click();
    const modal = page.getByRole('form', { name: /Add staff/i });
    await expect(modal.getByRole('heading', { name: /^Add staff$/i })).toBeVisible();
    await expect(modal.getByRole('textbox', { name: /Collaborator name/i })).toBeVisible();
    await expect(modal.getByRole('combobox', { name: /^Role$/i })).toBeVisible();
    await expect(modal.getByRole('combobox', { name: /Assigned zone/i })).toBeVisible();
    await modal.getByRole('button', { name: /^Cancel$/i }).click();
    await expect(page.getByRole('heading', { name: /^Add staff$/i })).toHaveCount(0);
  });

  test('opens manage permissions modal', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_ID}/staff-qr`);
    await expect(page.getByRole('button', { name: /Manage permissions/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /Manage permissions/i }).click();
    await expect(page.getByRole('heading', { name: /Manage permissions/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: /Close permissions|^Close$/i }).first().click();
    await expect(page.getByRole('heading', { name: /Manage permissions/i })).toHaveCount(0);
  });

  test('pause and resume a staff member', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_ID}/staff-qr`);
    await expect(page.getByText(/Showing \d+ to \d+ of \d+ staff/i)).toBeVisible({
      timeout: 20_000,
    });

    const pauseBtn = page.getByRole('button', { name: /^Pause$/i }).first();
    const resumeBtn = page.getByRole('button', { name: /^Resume$/i }).first();

    if (await pauseBtn.isVisible().catch(() => false)) {
      await pauseBtn.click();
      await expect(page.getByText(/Staff member updated/i)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('button', { name: /^Resume$/i }).first()).toBeVisible();
      await page.getByRole('button', { name: /^Resume$/i }).first().click();
      await expect(page.getByText(/Staff member updated/i)).toBeVisible({ timeout: 15_000 });
    } else {
      await expect(resumeBtn).toBeVisible();
      await resumeBtn.click();
      await expect(page.getByText(/Staff member updated/i)).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: /^Pause$/i }).first().click();
      await expect(page.getByText(/Staff member updated/i)).toBeVisible({ timeout: 15_000 });
    }
  });

  test('add staff, show QR, then delete', async ({ page }) => {
    const stamp = Date.now().toString().slice(-8);
    const name = `PW Staff ${stamp.slice(-6)}`;
    // Chilean mobile E.164: +56 9 XXXXXXXX
    const phone = `+569${stamp}`;

    await page.goto(`/admin/events/${EVENT_ID}/staff-qr`);
    await expect(page.getByRole('button', { name: /\+?\s*Add staff/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /\+?\s*Add staff/i }).click();

    const modal = page.getByRole('form', { name: /Add staff/i });
    await expect(modal.getByRole('heading', { name: /^Add staff$/i })).toBeVisible();
    await modal.getByRole('textbox', { name: /Collaborator name/i }).fill(name);
    const phoneInput = modal.getByRole('textbox', { name: /Phone number/i });
    await phoneInput.click();
    await phoneInput.fill('');
    await phoneInput.pressSequentially(phone, { delay: 20 });
    await expect(phoneInput).toHaveValue(/\+56/);
    await modal.getByRole('combobox', { name: /^Role$/i }).selectOption({ index: 1 });
    await modal.getByRole('combobox', { name: /Assigned zone/i }).selectOption({ index: 1 });
    await modal.getByRole('button', { name: /Save staff/i }).click();

    await expect(page.getByText(/Staff member added/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Staff QR code/i })).toBeVisible();
    await page.locator('.staff-qr-modal--qr-preview .primary-btn').click();
    await expect(page.getByText(name)).toBeVisible();

    const row = page.locator('tr').filter({ hasText: name });
    page.once('dialog', (confirm) => confirm.accept());
    await row.getByRole('button', { name: /^Delete$/i }).click();
    await expect(page.getByText(/Staff member deleted/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(name)).toHaveCount(0);
  });
});
