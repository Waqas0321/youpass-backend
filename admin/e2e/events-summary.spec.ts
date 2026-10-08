import { test, expect } from '@playwright/test';
import { forceEnglishLocale } from './helpers/auth';

const FINISHED_EVENT_ID = '6a9af01451cf57d0be8bb40b'; // Jazz & Wine (past published)

test.describe('Event summary', () => {
  test.beforeEach(async ({ page }) => {
    await forceEnglishLocale(page);
  });

  test('finished event shows FINISHED status and consistent capacity', async ({ page }) => {
    await page.goto(`/admin/events/${FINISHED_EVENT_ID}/summary`);

    await expect(page.getByRole('heading', { name: /Event summary/i })).toBeVisible();
    await expect(page.locator('.event-summary__status-value--finished')).toHaveText(/FINISHED/i);
    await expect(page.getByText(/This event has ended/i)).toBeVisible();

    // Sidebar badge should not falsely say DRAFT
    await expect(page.locator('.event-workspace__event-badge')).toHaveText(/FINISHED/i);

    const ticketsCard = page.locator('article.event-summary-kpi', { hasText: 'Tickets sold' });
    const remainingCard = page.locator('article.event-summary-kpi', {
      hasText: 'Remaining capacity',
    });

    await expect(ticketsCard).toContainText('2');
    await expect(remainingCard).toContainText('298');
    await expect(remainingCard).toContainText(/99%\s+available/i);
  });
});
