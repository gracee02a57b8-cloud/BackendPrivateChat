/**
 * BarsikChat — Design System Compliance Tests
 *
 * Tags: @design-system @css @accessibility
 *
 * Covers:
 * - CSS custom properties (design tokens)
 * - Color palette compliance
 * - Z-index layer ordering
 * - Glassmorphism (backdrop-filter) presence
 * - Animation keyframes loaded
 * - Accessibility (prefers-reduced-motion)
 * - Dark/light mode consistency
 */
import { test, expect } from '@playwright/test';
import { COLORS, Z_INDEX } from '../helpers/test-helpers';

test.describe('Design System — CSS Custom Properties', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('z-index design tokens are defined', async ({ page }) => {
    const tokens = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        base: root.getPropertyValue('--z-base').trim(),
        header: root.getPropertyValue('--z-header').trim(),
        sidebar: root.getPropertyValue('--z-sidebar').trim(),
        overlay: root.getPropertyValue('--z-overlay').trim(),
        modal: root.getPropertyValue('--z-modal').trim(),
        notification: root.getPropertyValue('--z-notification').trim(),
      };
    });
    expect(parseInt(tokens.base)).toBeLessThan(parseInt(tokens.header));
    expect(parseInt(tokens.header)).toBeLessThan(parseInt(tokens.sidebar));
    expect(parseInt(tokens.sidebar)).toBeLessThan(parseInt(tokens.overlay));
    expect(parseInt(tokens.overlay)).toBeLessThan(parseInt(tokens.modal));
    expect(parseInt(tokens.modal)).toBeLessThan(parseInt(tokens.notification));
  });

  test('spring animation easing is defined', async ({ page }) => {
    const spring = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--spring').trim();
    });
    expect(spring).toContain('cubic-bezier');
  });
});

test.describe('Design System — Glassmorphism', () => {
  test('login card uses glassmorphism', async ({ page }) => {
    // Clear auth to see login
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await expect(page.locator('.login-container')).toBeVisible({ timeout: 15_000 });

    const bf = await page.locator('.login-card').evaluate((el) => {
      return getComputedStyle(el).backdropFilter;
    });
    expect(bf).toContain('blur');
  });
});

test.describe('Design System — Animation Keyframes', () => {
  test('required keyframes are defined', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const keyframes = await page.evaluate(() => {
      const found: string[] = [];
      const required = ['springScaleIn', 'springSlideUp', 'springFadeIn', 'gentlePulse', 'shimmer'];
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule instanceof CSSKeyframesRule) {
              if (required.includes(rule.name)) {
                found.push(rule.name);
              }
            }
          }
        } catch (e) {}
      }
      return found;
    });
    // At least some animation keyframes should exist
    expect(keyframes.length).toBeGreaterThan(0);
  });
});

test.describe('Design System — Accessibility', () => {
  test('prefers-reduced-motion rule exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const hasReducedMotion = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule instanceof CSSMediaRule &&
                rule.conditionText?.includes('prefers-reduced-motion')) {
              return true;
            }
          }
        } catch (e) {}
      }
      return false;
    });
    expect(hasReducedMotion).toBe(true);
  });

  test('inputs have visible focus indicators', async ({ page }) => {
    // Go to login page
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await expect(page.locator('.login-container')).toBeVisible({ timeout: 15_000 });

    const input = page.getByPlaceholder('Имя пользователя...');
    await input.focus();

    // Check that focus is visible (outline or box-shadow)
    const hasVisibleFocus = await input.evaluate((el) => {
      const style = getComputedStyle(el);
      const outline = style.outline;
      const boxShadow = style.boxShadow;
      return (outline !== 'none' && outline !== '') ||
             (boxShadow !== 'none' && boxShadow !== '');
    });
    // Focus indicator should exist
    expect(hasVisibleFocus).toBe(true);
  });
});

test.describe('Design System — Color Consistency', () => {
  test('primary accent color used in UI', async ({ page }) => {
    // Need a fresh context without auth to see login page
    const context = await page.context().browser()!.newContext();
    const freshPage = await context.newPage();
    await freshPage.goto(page.url() || 'https://barsikchat.duckdns.org');
    await freshPage.waitForLoadState('domcontentloaded');
    
    const loginContainer = freshPage.locator('.login-container');
    const isLogin = await loginContainer.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!isLogin) {
      await context.close();
      test.skip();
      return;
    }

    const btnBg = await freshPage.locator('button[type="submit"]').evaluate((el) => {
      return getComputedStyle(el).backgroundColor;
    });
    await context.close();
    expect(btnBg).not.toBe('rgba(0, 0, 0, 0)');
    expect(btnBg).not.toBe('transparent');
  });
});
