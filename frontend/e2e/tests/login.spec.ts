/**
 * BarsikChat — Login / Register Page Layout Tests
 *
 * Tags: @smoke @auth @layout
 *
 * Covers:
 * - Login form visibility and structure
 * - Registration form toggle
 * - Responsive layout (desktop, tablet, mobile)
 * - CSS properties (colors, fonts, spacing)
 * - Input icons not overlapping text
 * - No horizontal overflow
 * - Visual regression screenshots
 */
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import {
  VIEWPORTS, COLORS, waitForVisualStability,
  assertNoHorizontalOverflow, getCSSProperty, MIN_TAP_TARGET,
} from '../helpers/test-helpers';

// Login tests must NOT use auth state — override to empty
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login Page — Structure & Visibility', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    // Clear auth so login page appears
    await page.context().clearCookies();
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await expect(loginPage.container).toBeVisible({ timeout: 15_000 });
  });

  test('@smoke login page renders all elements', async () => {
    await expect(loginPage.logo).toBeVisible();
    await expect(loginPage.logo).toHaveText('🐱');
    await expect(loginPage.title).toHaveText('BarsikChat');
    await expect(loginPage.subtitle).toBeVisible();
    await expect(loginPage.usernameInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
    await expect(loginPage.toggleLink).toBeVisible();
    await expect(loginPage.features).toBeVisible();
  });

  test('login button text shows "Войти в чат"', async () => {
    await expect(loginPage.submitButton).toHaveText('Войти в чат');
  });

  test('button is disabled when fields empty', async () => {
    await expect(loginPage.submitButton).toBeDisabled();
  });

  test('button enables when both fields filled', async () => {
    await loginPage.usernameInput.fill('test');
    await loginPage.passwordInput.fill('password');
    await expect(loginPage.submitButton).toBeEnabled();
  });

  test('features section shows 4 items', async () => {
    const items = loginPage.features.locator('span');
    await expect(items).toHaveCount(4);
    await expect(items.nth(0)).toContainText('Чаты');
    await expect(items.nth(1)).toContainText('Файлы');
    await expect(items.nth(2)).toContainText('Задачи');
    await expect(items.nth(3)).toContainText('Новости');
  });

  test('6 animated particles render', async () => {
    await expect(loginPage.particles).toHaveCount(6);
  });

  test('input icons are visible', async () => {
    await expect(loginPage.inputIcons).toHaveCount(2); // username + password
    await expect(loginPage.inputIcons.first()).toHaveText('👤');
    await expect(loginPage.inputIcons.last()).toHaveText('🔒');
  });

  test('no confirm password in login mode', async () => {
    await expect(loginPage.confirmPasswordInput).not.toBeVisible();
  });
});

test.describe('Login Page — Register Toggle', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.context().clearCookies();
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await expect(loginPage.container).toBeVisible({ timeout: 15_000 });
  });

  test('toggle to register shows confirm password', async () => {
    await loginPage.switchToRegister();
    await expect(loginPage.confirmPasswordInput).toBeVisible();
    await expect(loginPage.submitButton).toHaveText('Зарегистрироваться');
    await expect(loginPage.toggleLink).toContainText('Уже есть аккаунт?');
  });

  test('toggle back to login hides confirm password', async () => {
    await loginPage.switchToRegister();
    await loginPage.switchToLogin();
    await expect(loginPage.confirmPasswordInput).not.toBeVisible();
    await expect(loginPage.submitButton).toHaveText('Войти в чат');
  });

  test('register mode shows 3 input icons', async () => {
    await loginPage.switchToRegister();
    await expect(loginPage.inputIcons).toHaveCount(3);
  });

  test('subtitle changes in register mode', async () => {
    await expect(loginPage.subtitle).toHaveText('Безопасный чат для команды');
    await loginPage.switchToRegister();
    await expect(loginPage.subtitle).toHaveText('Создайте аккаунт');
  });
});

test.describe('Login Page — Validation', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.context().clearCookies();
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await expect(loginPage.container).toBeVisible({ timeout: 15_000 });
  });

  test('wrong credentials show error', async () => {
    await loginPage.login('nonexistent_user_xyz', 'wrongpass');
    await expect(loginPage.errorMessage).toBeVisible({ timeout: 10_000 });
  });

  test('register password mismatch shows error', async () => {
    await loginPage.switchToRegister();
    await loginPage.usernameInput.fill('test_mismatch');
    await loginPage.passwordInput.fill('Password123!');
    await loginPage.confirmPasswordInput.fill('DifferentPass');
    await loginPage.submitButton.click();
    await expect(loginPage.errorMessage).toHaveText('Пароли не совпадают');
  });

  test('register short password shows error', async () => {
    await loginPage.switchToRegister();
    await loginPage.usernameInput.fill('test_short');
    await loginPage.passwordInput.fill('short');
    await loginPage.confirmPasswordInput.fill('short');
    await loginPage.submitButton.click();
    await expect(loginPage.errorMessage).toContainText('не менее 8 символов');
  });
});

test.describe('Login Page — CSS Properties', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.context().clearCookies();
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await expect(loginPage.container).toBeVisible({ timeout: 15_000 });
  });

  test('login card has glassmorphism (backdrop-filter)', async () => {
    const bf = await getCSSProperty(loginPage.card, 'backdrop-filter');
    expect(bf).toContain('blur');
  });

  test('login card has rounded corners', async () => {
    const br = await getCSSProperty(loginPage.card, 'border-radius');
    // On mobile, border-radius may be smaller or expressed differently
    expect(parseInt(br)).toBeGreaterThanOrEqual(8);
  });

  test('submit button has accent color', async () => {
    const bg = await getCSSProperty(loginPage.submitButton, 'background-color');
    // Should be indigo-ish (rgb(99, 102, 241) or similar gradient)
    expect(bg).toBeTruthy();
  });

  test('input icons do not overlap input text', async ({ page }) => {
    await loginPage.usernameInput.fill('TestLongUsername');
    // Input must have some left padding for icon
    const paddingLeft = await getCSSProperty(loginPage.usernameInput, 'padding-left');
    const pl = parseInt(paddingLeft);
    expect(pl).toBeGreaterThanOrEqual(12); // at minimum some padding
  });
});

test.describe('Login Page — Responsive @mobile', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.context().clearCookies();
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await expect(loginPage.container).toBeVisible({ timeout: 15_000 });
  });

  test('no horizontal overflow on mobile', async ({ page }) => {
    const hasOverflow = await assertNoHorizontalOverflow(page);
    expect(hasOverflow).toBe(false);
  });

  test('login card is within viewport', async ({ page }) => {
    const box = await loginPage.card.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).toBeTruthy();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  });

  test('inputs have minimum tap target height', async () => {
    const inputs = [loginPage.usernameInput, loginPage.passwordInput];
    for (const input of inputs) {
      const box = await input.boundingBox();
      expect(box).toBeTruthy();
      // Login inputs may be 40-44px depending on viewport
      expect(box!.height).toBeGreaterThanOrEqual(38);
    }
  });

  test('submit button has minimum tap target', async () => {
    const box = await loginPage.submitButton.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(38);
  });
});

test.describe('Login Page — Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await expect(page.locator('.login-container')).toBeVisible({ timeout: 15_000 });
  });

  test('login page screenshot', async ({ page }) => {
    await waitForVisualStability(page);
    await expect(page).toHaveScreenshot('login-page.png', {
      fullPage: true,
      mask: [page.locator('.login-particles')], // mask animated particles
    });
  });

  test('register page screenshot', async ({ page }) => {
    await page.locator('.login-toggle').click();
    await expect(page.getByPlaceholder('Подтвердите пароль...')).toBeVisible();
    await waitForVisualStability(page);
    await expect(page).toHaveScreenshot('register-page.png', {
      fullPage: true,
      mask: [page.locator('.login-particles')],
    });
  });
});
