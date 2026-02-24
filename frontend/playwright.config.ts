import { defineConfig, devices } from '@playwright/test';

/**
 * BarsikChat — Playwright E2E & Layout Test Configuration
 *
 * Три ключевых разрешения:
 *   • Desktop  — 1920×1080 (Chromium, Firefox, WebKit)
 *   • Tablet   — 768×1024  (iPad)
 *   • Mobile   — 375×667   (iPhone SE)
 *
 * Запуск:
 *   npx playwright test                   — все тесты (headless)
 *   npx playwright test --headed          — видимый браузер
 *   npx playwright test --update-snapshots — обновить скриншоты-эталоны
 *   npx playwright test --grep @mobile    — только мобильные тесты
 *   npx playwright test --grep @smoke     — smoke-тесты
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  timeout: 30_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.1,
      threshold: 0.3,
      animations: 'disabled',
    },
  },

  use: {
    baseURL: process.env.BASE_URL || 'https://barsikchat.duckdns.org',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    /* ──────────────── Setup ──────────────── */
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },

    /* ──────────────── Desktop ──────────────── */
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox-desktop',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'webkit-desktop',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    /* ──────────────── Tablet ──────────────── */
    {
      name: 'tablet',
      use: {
        ...devices['iPad (gen 7)'],
        viewport: { width: 768, height: 1024 },
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    /* ──────────────── Mobile ──────────────── */
    {
      name: 'mobile-chromium',
      use: {
        ...devices['iPhone SE'],
        viewport: { width: 375, height: 667 },
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-webkit',
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 390, height: 844 },
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
