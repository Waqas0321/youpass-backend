import type { Page } from '@playwright/test';

const ADMIN_KEY = process.env.ADMIN_API_KEY ?? 'youpass-dev-admin-key';

export async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.locator('input[type="email"]').fill('admin@youpass.com');
  await page.locator('input[type="password"], input[autocomplete="current-password"]').fill(ADMIN_KEY);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/?$/);
}

/** Prefer English UI labels for stable selectors. */
export async function forceEnglishLocale(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('youpass-admin-locale', 'en');
  });
}
