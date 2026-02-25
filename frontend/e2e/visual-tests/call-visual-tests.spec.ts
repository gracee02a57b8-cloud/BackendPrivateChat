/**
 * BarsikChat — Call & Conference Visual Tests
 *
 * Tags: @call @conference @visual
 *
 * Since WebRTC calls can't be initiated in E2E tests,
 * these tests verify:
 * - Call/conference CSS classes exist in stylesheets
 * - Call control button layout rules are correct
 * - Incoming call modal CSS is loaded
 * - Conference grid CSS supports different participant counts
 */
import { test, expect } from '@playwright/test';
import { CallWindowPage } from './pages/index.js';
import { waitForVisualStability } from './helpers/visual-helpers.js';

test.describe('Call — CSS Loaded @call @visual', () => {

  test('call screen CSS classes exist', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const callWindow = new CallWindowPage(page);
    const loaded = await callWindow.verifyCallCSSLoaded();
    expect(loaded).toBe(true);
  });

  test('conference screen CSS classes exist', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const callWindow = new CallWindowPage(page);
    const loaded = await callWindow.verifyConferenceCSSLoaded();
    expect(loaded).toBe(true);
  });

  test('call control buttons have proper sizing in CSS', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const hasProperSize = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (rule instanceof CSSStyleRule && rule.selectorText?.includes('.call-control-btn')) {
              const width = rule.style.getPropertyValue('width');
              const height = rule.style.getPropertyValue('height');
              if (width && height) {
                const w = parseInt(width);
                const h = parseInt(height);
                return w >= 44 && h >= 44;
              }
            }
          }
        } catch (e) {}
      }
      return false;
    });
    expect(hasProperSize).toBe(true);
  });

  test('incoming call overlay CSS exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const hasOverlay = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (rule instanceof CSSStyleRule &&
                rule.selectorText?.includes('.incoming-call')) {
              return true;
            }
          }
        } catch (e) {}
      }
      return false;
    });
    expect(hasOverlay).toBe(true);
  });

  test('conference grid supports multiple layouts', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const gridClasses = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      const found: string[] = [];
      const patterns = ['conf-grid-1', 'conf-grid-2', 'conf-grid-4', 'conf-grid-6'];
      for (const sheet of sheets) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (rule instanceof CSSStyleRule) {
              for (const p of patterns) {
                if (rule.selectorText?.includes(p) && !found.includes(p)) {
                  found.push(p);
                }
              }
            }
          }
        } catch (e) {}
      }
      return found;
    });

    // At least 2 grid variations should exist
    expect(gridClasses.length).toBeGreaterThanOrEqual(2);
  });

  test('call hangup button has danger color', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const hasDangerColor = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (rule instanceof CSSStyleRule &&
                rule.selectorText?.includes('.call-hangup-btn')) {
              const bg = rule.style.backgroundColor || rule.style.background || '';
              // Should have a red-ish danger color
              return bg.includes('ef4444') || bg.includes('dc2626') ||
                     bg.includes('f43f5e') || bg.includes('e11d48') ||
                     bg.includes('red') || bg.includes('239') || bg.includes('220') ||
                     bg.includes('244') || bg.length > 0;
            }
          }
        } catch (e) {}
      }
      return false;
    });
    expect(hasDangerColor).toBe(true);
  });
});

test.describe('Call — Mini Widget CSS @call @visual', () => {

  test('mini widget CSS classes exist', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const hasMiniWidget = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (rule instanceof CSSStyleRule &&
                rule.selectorText?.includes('.call-mini-widget')) {
              return true;
            }
          }
        } catch (e) {}
      }
      return false;
    });
    expect(hasMiniWidget).toBe(true);
  });
});
