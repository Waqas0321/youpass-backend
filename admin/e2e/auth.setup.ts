import { test as setup, expect } from '@playwright/test';
import { forceEnglishLocale, loginAsAdmin } from './helpers/auth';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '.auth/admin.json');

setup('authenticate admin', async ({ page }) => {
  await forceEnglishLocale(page);
  await loginAsAdmin(page);
  await expect(page).toHaveURL(/\/admin\/?$/);
  await page.context().storageState({ path: authFile });
});
