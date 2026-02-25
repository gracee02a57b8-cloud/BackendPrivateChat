/**
 * BarsikChat — Visual Testing Helpers
 *
 * Shared utilities for screenshot tests, masking, viewport checks
 */
import { type Page, type Locator, expect } from '@playwright/test';

/* ═══════════════ Viewport Presets ═══════════════ */
export const VIEWPORTS = {
  '360x640':   { width: 360,  height: 640 },
  '375x667':   { width: 375,  height: 667 },
  '390x844':   { width: 390,  height: 844 },
  '414x896':   { width: 414,  height: 896 },
  '768x1024':  { width: 768,  height: 1024 },
  '1024x768':  { width: 1024, height: 768 },
  '1920x1080': { width: 1920, height: 1080 },
  '2560x1440': { width: 2560, height: 1440 },
} as const;

export type ViewportKey = keyof typeof VIEWPORTS;

/** Whether viewport is mobile (<= 768px width) */
export function isMobileViewport(width: number): boolean {
  return width <= 768;
}

/** Whether viewport is tablet (769-1024px width) */
export function isTabletViewport(width: number): boolean {
  return width > 768 && width <= 1024;
}

/** Whether viewport is desktop (> 1024px width) */
export function isDesktopViewport(width: number): boolean {
  return width > 1024;
}

/* ═══════════════ WCAG Touch Target ═══════════════ */
export const MIN_TAP_TARGET = 44; // WCAG 2.5.8 minimum

/* ═══════════════ Test Credentials ═══════════════ */
export const TEST_USER = process.env.TEST_USER || 'playwright_tester';
export const TEST_PASS = process.env.TEST_PASS || 'TestPass2026!';

/* ═══════════════ Visual Stability ═══════════════ */

/** Wait for fonts, images, and CSS animations to settle */
export async function waitForVisualStability(page: Page, delay = 1000) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('domcontentloaded');
  // Disable all CSS animations/transitions
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
  await page.waitForTimeout(delay);
}

/** Dismiss overlay banners that interfere with screenshots */
export async function dismissBanners(page: Page) {
  await page.evaluate(() => {
    const selectors = [
      '.media-perm-banner',
      '.connection-banner',
      '.pwa-install-prompt',
      '.toast-container',
    ];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
    });
  }).catch(() => {});
  await page.waitForTimeout(300);
}

/** Freeze all dynamic content for stable screenshots */
export async function freezeDynamicContent(page: Page) {
  await page.evaluate(() => {
    // Freeze timestamps to static text
    document.querySelectorAll('.sb-chat-time').forEach(el => {
      (el as HTMLElement).textContent = '12:00';
    });
    // Freeze message timestamps
    document.querySelectorAll('.message-meta').forEach(el => {
      const time = el.querySelector('.message-time, time');
      if (time) (time as HTMLElement).textContent = '12:00';
    });
    // Hide online dots
    document.querySelectorAll('.sb-online-dot').forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
    // Normalize badges
    document.querySelectorAll('.sb-badge, .bottom-nav-badge').forEach(el => {
      (el as HTMLElement).textContent = '0';
      (el as HTMLElement).style.display = 'none';
    });
    // Hide connection banner
    document.querySelectorAll('.connection-banner').forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
    // Replace avatar images with placeholder
    document.querySelectorAll('img[src*="avatar"], img[src*="upload"]').forEach(el => {
      (el as HTMLImageElement).style.visibility = 'hidden';
    });
  }).catch(() => {});
}

/* ═══════════════ Layout Assertions ═══════════════ */

/** Check no horizontal overflow (no unwanted scrollbar) */
export async function assertNoHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
}

/** Check element is fully within viewport */
export async function isWithinViewport(page: Page, locator: Locator): Promise<boolean> {
  const box = await locator.boundingBox();
  if (!box) return false;
  const vp = page.viewportSize();
  if (!vp) return false;
  return box.x >= -1 && box.y >= -1 &&
         box.x + box.width <= vp.width + 1 &&
         box.y + box.height <= vp.height + 1;
}

/** Check two elements don't overlap */
export async function elementsDoNotOverlap(a: Locator, b: Locator): Promise<boolean> {
  const boxA = await a.boundingBox();
  const boxB = await b.boundingBox();
  if (!boxA || !boxB) return true;
  return (
    boxA.x + boxA.width <= boxB.x + 2 ||
    boxB.x + boxB.width <= boxA.x + 2 ||
    boxA.y + boxA.height <= boxB.y + 2 ||
    boxB.y + boxB.height <= boxA.y + 2
  );
}

/** Get computed CSS property */
export async function getCSSProperty(locator: Locator, property: string): Promise<string> {
  return locator.evaluate((el, prop) => {
    return window.getComputedStyle(el).getPropertyValue(prop);
  }, property);
}

/** Check bounding box meets minimum size */
export async function assertMinimumSize(
  locator: Locator,
  minWidth: number,
  minHeight: number
): Promise<{ pass: boolean; actual: { width: number; height: number } | null }> {
  const box = await locator.boundingBox();
  if (!box) return { pass: false, actual: null };
  return {
    pass: box.width >= minWidth && box.height >= minHeight,
    actual: { width: Math.round(box.width), height: Math.round(box.height) },
  };
}

/* ═══════════════ Default Masks for Screenshots ═══════════════ */

/** Get default mask locators for stable full-page screenshots */
export function getDefaultMasks(page: Page): Locator[] {
  return [
    page.locator('.sb-chat-time'),
    page.locator('.sb-chat-preview'),
    page.locator('.sb-online-dot'),
    page.locator('.sb-badge'),
    page.locator('.bottom-nav-badge'),
    page.locator('.connection-banner'),
    page.locator('.media-perm-banner'),
    page.locator('.message-meta'),
    page.locator('.typing-indicator'),
    page.locator('.toast'),
    page.locator('img[src*="avatar"]'),
    page.locator('img[src*="upload"]'),
    page.locator('.pwa-install-prompt'),
  ];
}

/* ═══════════════ Login Helper ═══════════════ */

/** Quick login for tests that don't use storageState */
export async function quickLogin(page: Page, user = TEST_USER, pass = TEST_PASS) {
  await page.goto('/');
  await page.waitForTimeout(1000);

  // Check if already logged in
  if (await page.locator('.chat-container').count() > 0) return;

  await page.getByPlaceholder('Имя пользователя...').fill(user);
  await page.getByPlaceholder('Пароль...').first().fill(pass);
  await page.locator('button[type="submit"]').click();
  await page.locator('.chat-container').waitFor({ timeout: 15_000 });
  await page.waitForTimeout(2000);
}
