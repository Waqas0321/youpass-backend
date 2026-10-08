import { test, expect } from '@playwright/test';
import { forceEnglishLocale } from './helpers/auth';
import { deleteEventById, seedEvent } from './helpers/api';

test.describe('Event map (floor plan)', () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('loads map workspace with edit and preview actions', async ({ page }) => {
    const title = `PW Map ${Date.now()}`;
    const seeded = await seedEvent(title);

    try {
      await page.goto(`/admin/events/${seeded.id}/floor-plan`);
      await expect(page.getByRole('heading', { name: /Event map|Floor plan|Plano/i })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByRole('button', { name: /Edit map|Editar mapa/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Preview app|Preview/i })).toBeVisible();
      await expect(page.getByText(/No map uploaded yet|Aún no hay mapa/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Upload map|Subir mapa/i })).toBeVisible();
      await expect(page.locator('body')).not.toContainText('Something went wrong');
      await expect(page.locator('body')).not.toContainText('Cannot GET /api');
    } finally {
      await deleteEventById(seeded.id);
    }
  });

  test('edit map modal opens and closes', async ({ page }) => {
    const title = `PW MapEdit ${Date.now()}`;
    const seeded = await seedEvent(title);

    try {
      await page.goto(`/admin/events/${seeded.id}/floor-plan`);
      await expect(page.getByRole('button', { name: /Edit map/i })).toBeVisible({ timeout: 20_000 });
      await page.getByRole('button', { name: /Edit map/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('heading', { name: /Edit map/i })).toBeVisible();
      await expect(dialog.getByText(/Drag your image here|Arrastra/i)).toBeVisible();
      await dialog.getByRole('button', { name: /Cancel|Cancelar/i }).click();
      await expect(dialog).toBeHidden();
    } finally {
      await deleteEventById(seeded.id);
    }
  });

  test('preview modal opens for empty map', async ({ page }) => {
    const title = `PW MapPreview ${Date.now()}`;
    const seeded = await seedEvent(title);

    try {
      await page.goto(`/admin/events/${seeded.id}/floor-plan`);
      await expect(page.getByRole('button', { name: /Preview app/i })).toBeVisible({ timeout: 20_000 });
      await page.getByRole('button', { name: /Preview app/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('heading', { name: /App preview|Vista previa/i })).toBeVisible();
      await dialog.getByRole('button', { name: /Close|Cerrar/i }).first().click();
      await expect(dialog).toBeHidden();
    } finally {
      await deleteEventById(seeded.id);
    }
  });

  test('create and delete a VIP zone', async ({ page }) => {
    const title = `PW MapZone ${Date.now()}`;
    const seeded = await seedEvent(title);
    const zoneName = `VIP E2E ${Date.now().toString().slice(-4)}`;

    try {
      await page.goto(`/admin/events/${seeded.id}/floor-plan`);
      await expect(page.getByRole('heading', { name: /VIP zones|Zonas VIP/i })).toBeVisible({
        timeout: 20_000,
      });

      await page.getByRole('button', { name: /Add zone|Add your first zone|Agregar/i }).first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: /Add VIP zone|Agregar zona/i })).toBeVisible();
      await dialog.getByPlaceholder(/VIP DJ/i).fill(zoneName);
      await dialog.locator('input[type="number"]').fill('10');
      await dialog.getByRole('button', { name: /Create zone|Crear zona/i }).click();

      await expect(page.getByText(zoneName)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/tables · default capacity|mesas · capacidad/i)).toBeVisible();

      page.once('dialog', (d) => d.accept());
      await page.getByRole('button', { name: /^Delete$|^Eliminar$/i }).first().click();
      await expect(page.getByText(zoneName)).toHaveCount(0, { timeout: 15_000 });
      await expect(page.getByText(/No VIP zones yet|Aún no hay zonas VIP/i)).toBeVisible();
    } finally {
      await deleteEventById(seeded.id);
    }
  });
});
