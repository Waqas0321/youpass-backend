import { test, expect } from '@playwright/test';
import { forceEnglishLocale } from './helpers/auth';
import { deleteEventById, seedEvent, updateEventApi } from './helpers/api';

const MODULES: Array<{ route: string; nav: RegExp; assert: RegExp }> = [
  { route: 'summary', nav: /Summary/i, assert: /Summary|Resumen|sales|event/i },
  { route: 'info', nav: /Event information|Información/i, assert: /Event name|information|Información|Save changes/i },
  { route: 'tickets', nav: /^Tickets$/i, assert: /Ticket|Entrada|offering|Create/i },
  { route: 'floor-plan', nav: /Event map|mapa|Floor/i, assert: /map|zona|zone|floor|plano/i },
  { route: 'vip-tables', nav: /VIP tables|mesas VIP/i, assert: /VIP|table|mesa/i },
  { route: 'drinks', nav: /Drink menu|Carta|bebidas/i, assert: /Drink|Product|Category|bebida|producto/i },
  { route: 'orders', nav: /Purchases|orders|Compras|pedidos/i, assert: /Order|Purchase|pedido|compra/i },
  { route: 'staff-qr', nav: /Staff QR/i, assert: /Staff|QR|scanner|PIN/i },
  { route: 'analytics', nav: /Analytics|Analítica/i, assert: /Analytics|sales|chart|gráfic|Analítica/i },
  { route: 'invitations', nav: /Invitations|Invitaciones/i, assert: /Invitation|Invite|Invit/i },
  { route: 'comps', nav: /Complimentary|Cortes[ií]as/i, assert: /Comp|Complimentary|Courtesy|Cortes/i },
  { route: 'payments', nav: /Payments|Pagos|finance/i, assert: /Payment|Finance|Pago|revenue/i },
];

test.describe('Event workspace modules', () => {
  let eventId = '';
  let title = '';

  test.beforeAll(async () => {
    title = `PW Modules ${Date.now()}`;
    const seeded = await seedEvent(title);
    eventId = seeded.id;
    // Publish so manage flow / workspace matches published events
    await updateEventApi(eventId, { status: 'published' });
  });

  test.afterAll(async () => {
    if (eventId) await deleteEventById(eventId);
  });

  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('open manage from list lands on summary', async ({ page }) => {
    await page.goto('/admin/events');
    await page.getByPlaceholder(/Search event/i).fill(title);
    const card = page.locator('article.events-list-card', { hasText: title }).first();
    await expect(card).toBeVisible();
    await card.getByRole('link', { name: /Manage/i }).click();
    await expect(page).toHaveURL(new RegExp(`/events/${eventId}/summary`));
  });

  for (const mod of MODULES) {
    test(`module link works: ${mod.route}`, async ({ page }) => {
      await page.goto(`/admin/events/${eventId}/summary`);
      const nav = page.locator('nav, aside, .event-workspace').first();
      // Prefer sidebar workspace nav link
      const link = page.locator(`a[href="/admin/events/${eventId}/${mod.route}"], a[href="/admin/events/${eventId}/${mod.route}"]`).first();
      if (await link.count()) {
        await link.click();
      } else {
        await page.getByRole('link', { name: mod.nav }).first().click();
      }
      await expect(page).toHaveURL(new RegExp(`/events/${eventId}/${mod.route}`));
      // Page should render without a hard crash — body has meaningful content
      await expect(page.locator('body')).toContainText(mod.assert);
      // No uncaught "Cannot GET" style blank API error as whole page
      await expect(page.locator('body')).not.toContainText('Cannot GET /api');
    });
  }

  test('direct deep-links for every module load', async ({ page }) => {
    for (const mod of MODULES) {
      const response = await page.goto(`/admin/events/${eventId}/${mod.route}`);
      expect(response?.ok() || response?.status() === 304).toBeTruthy();
      await expect(page).toHaveURL(new RegExp(`/events/${eventId}/${mod.route}`));
      await expect(page.locator('body')).not.toContainText('Something went wrong');
    }
  });
});
