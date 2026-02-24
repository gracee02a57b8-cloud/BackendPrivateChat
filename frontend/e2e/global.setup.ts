/**
 * BarsikChat — Global Setup: authenticate and save storage state
 *
 * Creates a test user via register (or logs in if exists)
 * and saves auth state to e2e/.auth/user.json for all projects.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authDir = path.join(__dirname, '.auth');
const authFile = path.join(authDir, 'user.json');

const TEST_USER = process.env.TEST_USER || 'playwright_tester';
const TEST_PASS = process.env.TEST_PASS || 'TestPass2026!';

setup('authenticate', async ({ page }) => {
  // Ensure auth directory exists
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  await page.goto('/');

  // Wait for login page to load
  await expect(page.locator('.login-container')).toBeVisible({ timeout: 15_000 });

  // Try to register first (may fail if user exists, then login)
  const loginToggle = page.locator('.login-toggle');
  const submitBtn = page.locator('button[type="submit"]');

  // Switch to register
  await loginToggle.click();
  await expect(page.getByPlaceholder('Подтвердите пароль...')).toBeVisible();

  // Fill registration form
  await page.getByPlaceholder('Имя пользователя...').fill(TEST_USER);
  await page.getByPlaceholder('Пароль...').first().fill(TEST_PASS);
  await page.getByPlaceholder('Подтвердите пароль...').fill(TEST_PASS);
  await submitBtn.click();

  // Wait for either success (chat loads) or error (user exists)
  const chatOrError = await Promise.race([
    page.locator('.chat-container').waitFor({ timeout: 10_000 }).then(() => 'chat'),
    page.locator('.error').waitFor({ timeout: 10_000 }).then(() => 'error'),
  ]);

  if (chatOrError === 'error') {
    // User already exists — switch to login
    await loginToggle.click();
    await page.getByPlaceholder('Имя пользователя...').fill(TEST_USER);
    await page.getByPlaceholder('Пароль...').first().fill(TEST_PASS);
    await submitBtn.click();
    await expect(page.locator('.chat-container')).toBeVisible({ timeout: 15_000 });
  }

  // Ensure we're in the chat — WebSocket connected
  await page.waitForTimeout(2000);

  // Save storage state
  await page.context().storageState({ path: authFile });
});
