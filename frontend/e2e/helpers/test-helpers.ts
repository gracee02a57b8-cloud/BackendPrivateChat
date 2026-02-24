/**
 * BarsikChat — Shared test helpers & constants
 */

/** Viewport presets */
export const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
  mobileLandscape: { width: 667, height: 375 },
  smallMobile: { width: 360, height: 640 },
} as const;

/** Design system colors (iOS 2026 glassmorphism) */
export const COLORS = {
  accent: '#6366f1',       // indigo-500
  accentLight: 'rgba(99, 102, 241, 0.1)',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  glass: 'rgba(255, 255, 255, 0.65)',
  white: '#ffffff',
  onlineDot: '#22c55e',
} as const;

/** Z-index layers */
export const Z_INDEX = {
  base: 1,
  header: 20,
  dropdown: 100,
  sidebar: 1000,
  overlay: 3000,
  callScreen: 9998,
  modal: 9999,
  notification: 10000,
} as const;

/** Min mobile breakpoint */
export const MOBILE_BREAKPOINT = 768;
export const SMALL_MOBILE_BREAKPOINT = 480;

/** Min touch target size (WCAG) */
export const MIN_TAP_TARGET = 44;

/** Test user credentials */
export const TEST_USER = process.env.TEST_USER || 'playwright_tester';
export const TEST_PASS = process.env.TEST_PASS || 'TestPass2026!';

/**
 * Wait for all fonts and images to load before taking screenshots
 */
export async function waitForVisualStability(page: import('@playwright/test').Page) {
  await page.evaluate(() => document.fonts.ready);
  // Don't use 'networkidle' — WebSocket keeps the connection alive
  await page.waitForLoadState('domcontentloaded');
  // Extra stability wait for CSS animations to settle
  await page.waitForTimeout(1000);
}

/**
 * Check no horizontal overflow (no unwanted scrollbar)
 */
export async function assertNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  return overflow;
}

/**
 * Get computed CSS property of an element
 */
export async function getCSSProperty(
  locator: import('@playwright/test').Locator,
  property: string
): Promise<string> {
  return locator.evaluate((el, prop) => {
    return window.getComputedStyle(el).getPropertyValue(prop);
  }, property);
}

/**
 * Check element is fully within viewport
 */
export async function isWithinViewport(
  page: import('@playwright/test').Page,
  locator: import('@playwright/test').Locator
): Promise<boolean> {
  const box = await locator.boundingBox();
  if (!box) return false;
  const viewport = page.viewportSize();
  if (!viewport) return false;
  return (
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= viewport.width &&
    box.y + box.height <= viewport.height
  );
}

/**
 * Check two elements don't overlap
 */
export async function elementsDoNotOverlap(
  a: import('@playwright/test').Locator,
  b: import('@playwright/test').Locator
): Promise<boolean> {
  const boxA = await a.boundingBox();
  const boxB = await b.boundingBox();
  if (!boxA || !boxB) return true; // if one is hidden, no overlap
  return (
    boxA.x + boxA.width <= boxB.x ||
    boxB.x + boxB.width <= boxA.x ||
    boxA.y + boxA.height <= boxB.y ||
    boxB.y + boxB.height <= boxA.y
  );
}
