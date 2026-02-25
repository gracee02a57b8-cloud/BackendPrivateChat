import { defineConfig, devices } from '@playwright/test';

/**
 * BarsikChat — Visual & Layout Regression Testing Config
 *
 * ┌───────────────────────────────────────────────────────┐
 * │  Browsers: Chromium · Firefox · WebKit                │
 * │  Viewports: 8 sizes + 2 real devices (iPhone 12,     │
 * │             Pixel 5)                                  │
 * │  Screenshots: toHaveScreenshot + Percy integration    │
 * │  Video: on failure                                    │
 * └───────────────────────────────────────────────────────┘
 *
 * Usage:
 *   npx playwright test -c playwright-visual.config.ts
 *   npx playwright test -c playwright-visual.config.ts --update-snapshots
 *   npx playwright test -c playwright-visual.config.ts --project=iphone12
 *   npx playwright test -c playwright-visual.config.ts --grep @screenshot
 */
export default defineConfig({
  testDir: './e2e/visual-tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 4,

  reporter: [
    ['html', { open: 'never', outputFolder: 'visual-report' }],
    ['list'],
    ['json', { outputFile: 'visual-results.json' }],
  ],

  timeout: 60_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
      animations: 'disabled',
    },
    toMatchSnapshot: {
      maxDiffPixelRatio: 0.02,
    },
  },

  use: {
    baseURL: process.env.BASE_URL || 'https://barsikchat.duckdns.org',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
  },

  projects: [
    /* ═══════════════════════ Setup ═══════════════════════ */
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
      testDir: './e2e',
    },

    /* ═══════════════ Chromium Viewports ═══════════════ */
    {
      name: 'chromium-360x640',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 640 },
        isMobile: true,
        hasTouch: true,
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'chromium-375x667',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'chromium-390x844',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'chromium-414x896',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 414, height: 896 },
        isMobile: true,
        hasTouch: true,
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'chromium-768x1024',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'chromium-1024x768',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 768 },
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'chromium-1920x1080',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'chromium-2560x1440',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 2560, height: 1440 },
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    /* ═══════════ Real Device Emulation ═══════════ */
    {
      name: 'iphone12',
      use: {
        ...devices['iPhone 12'],
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'pixel5',
      use: {
        ...devices['Pixel 5'],
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    /* ═══════════ Firefox Desktop ═══════════ */
    {
      name: 'firefox-1920x1080',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    /* ═══════════ WebKit Desktop ═══════════ */
    {
      name: 'webkit-1920x1080',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    /* ═══════════ WebKit Mobile (Safari) ═══════════ */
    {
      name: 'webkit-iphone12',
      use: {
        ...devices['iPhone 12'],
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
