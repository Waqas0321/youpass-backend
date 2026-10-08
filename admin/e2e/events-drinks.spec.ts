import { test, expect } from '@playwright/test';
import { forceEnglishLocale } from './helpers/auth';
import { deleteEventById, seedEvent } from './helpers/api';

const EVENT_WITH_DRINKS = '6a9af01451cf57d0be8bb40b'; // Jazz & Wine

test.describe('Drink menu', () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('loads drink menu with categories and actions', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_WITH_DRINKS}/drinks`);
    await expect(page.getByRole('heading', { name: /^Drink menu$/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /Create category/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Add product/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^All$/i })).toBeVisible();
    await expect(page.getByText(/Showing \d+ to \d+ of \d+ products/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('heading', { name: /Piscola|Cuba Libre|Tropical Gin/i }).first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('add product modal opens', async ({ page }) => {
    await page.goto(`/admin/events/${EVENT_WITH_DRINKS}/drinks`);
    await expect(page.getByRole('button', { name: /Add product/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Add product/i }).click();
    await expect(page.getByRole('heading', { name: /Add product/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Product name/i })).toBeVisible();
  });

  test('blocks add product until a category exists', async ({ page }) => {
    const seeded = await seedEvent(`PW Drinks Gate ${Date.now()}`);
    try {
      await page.goto(`/admin/events/${seeded.id}/drinks`);
      await expect(page.getByRole('heading', { name: /^Drink menu$/i })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByRole('banner').getByRole('button', { name: /Add product/i })).toBeDisabled();
    } finally {
      await deleteEventById(seeded.id);
    }
  });

  test('create category on seeded event then clean up via UI flow', async ({ page }) => {
    const title = `PW Drinks ${Date.now()}`;
    const seeded = await seedEvent(title);

    try {
      await page.goto(`/admin/events/${seeded.id}/drinks`);
      await expect(page.getByRole('heading', { name: /^Drink menu$/i })).toBeVisible({
        timeout: 20_000,
      });
      await page.getByRole('button', { name: /Create category/i }).click();
      await expect(page.getByRole('heading', { name: /Create category/i })).toBeVisible();
      const name = `PW Cat ${Date.now()}`;
      await page.locator('#event-drink-category-form input').first().fill(name);
      await page.getByRole('button', { name: /^Create$/i }).click();
      await expect(page.getByText(/Category created/i)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('button', { name: new RegExp(name, 'i') })).toBeVisible();
      await expect(page.getByRole('banner').getByRole('button', { name: /Add product/i })).toBeEnabled();
    } finally {
      await deleteEventById(seeded.id);
    }
  });

  test('create product, hide, mark available, and delete', async ({ page }) => {
    const seeded = await seedEvent(`PW Drinks CRUD ${Date.now()}`);
    const categoryName = `PW Cat ${Date.now().toString().slice(-4)}`;
    const productName = `PW Drink ${Date.now().toString().slice(-4)}`;

    try {
      await page.goto(`/admin/events/${seeded.id}/drinks`);
      await expect(page.getByRole('heading', { name: /^Drink menu$/i })).toBeVisible({
        timeout: 20_000,
      });

      await page.getByRole('button', { name: /Create category/i }).click();
      await page.locator('#event-drink-category-form input').first().fill(categoryName);
      await page.getByRole('button', { name: /^Create$/i }).click();
      await expect(page.getByText(/Category created/i)).toBeVisible({ timeout: 15_000 });

      await page.getByRole('banner').getByRole('button', { name: /Add product/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: /Add product/i })).toBeVisible();
      const nameInput = dialog.getByRole('textbox', { name: /Product name/i });
      const priceInput = dialog.getByRole('spinbutton', { name: /Sale price/i });
      const stockInput = dialog.getByRole('spinbutton', { name: /Total event stock/i });
      await expect(dialog.getByRole('combobox', { name: /Category/i })).not.toHaveValue('');

      await nameInput.fill(productName);
      await expect(nameInput).toHaveValue(productName);
      await priceInput.fill('12');
      await expect(priceInput).toHaveValue('12');
      await stockInput.fill('40');
      await expect(stockInput).toHaveValue('40');
      await dialog.getByRole('button', { name: /Save product/i }).click();

      await expect(page.getByText(/Product created/i)).toBeVisible({ timeout: 15_000 });
      const card = page.locator('article.drink-product-card').filter({ hasText: productName });
      await expect(card).toBeVisible();
      await expect(card.locator('.drink-status--available')).toBeVisible();

      await card.getByRole('button', { name: /^Hide$/i }).click();
      await expect(page.getByText(/Product updated/i)).toBeVisible({ timeout: 15_000 });
      await expect(card.locator('.drink-status--hidden')).toBeVisible();

      await card.getByRole('button', { name: /Mark available/i }).click();
      await expect(page.getByText(/Product is available again/i)).toBeVisible({ timeout: 15_000 });
      await expect(card.locator('.drink-status--available')).toBeVisible();

      page.once('dialog', (confirm) => confirm.accept());
      await card.getByRole('button', { name: /^Delete$/i }).click();
      await expect(page.getByText(/Product deleted/i)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('heading', { name: productName })).toHaveCount(0);
    } finally {
      await deleteEventById(seeded.id);
    }
  });
});
