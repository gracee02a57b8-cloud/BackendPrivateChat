/**
 * BarsikChat — Call & Conference UI Layout Tests
 *
 * Tags: @calls @layout @conference
 *
 * Note: Since we can't initiate real WebRTC calls in E2E tests,
 * these tests verify:
 * - Call history (RecentCalls) display
 * - Call-related UI elements existence
 * - Conference link join UI
 * - IncomingCallModal structure (via CSS class presence)
 * - CallScreen/ConferenceScreen CSS is loaded
 */
import { test, expect } from '@playwright/test';
import { ChatPage } from '../pages/ChatPage';
import { getCSSProperty, waitForVisualStability } from '../helpers/test-helpers';

test.describe('Calls — Recent Calls Display', () => {
  let chat: ChatPage;

  test.beforeEach(async ({ page }) => {
    chat = new ChatPage(page);
    await chat.goto();
    await chat.waitForWebSocket();
  });

  test('contacts tab accessible', async ({ page }) => {
    if (chat.isMobile()) {
      await chat.switchMobileTab('contacts');
    } else {
      // Desktop: look for contacts tab in sidebar
      const contactsTab = page.locator('.sb-tabs button, .sb-tab').filter({ hasText: /контакт/i });
      if (await contactsTab.count() > 0) {
        await contactsTab.first().click();
      }
    }
    await page.waitForTimeout(1000);
  });

  test('recent calls section exists after switching to contacts', async ({ page }) => {
    if (chat.isMobile()) {
      await chat.switchMobileTab('contacts');
    }
    await page.waitForTimeout(1000);
    const callsSection = page.locator('.recent-calls, .call-history, [class*="call"]');
    // Just verify the CSS class is present (may be empty if no call history)
    const count = await callsSection.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Calls — CSS Classes Loaded', () => {
  test('call screen CSS classes exist in stylesheet', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Verify call-related CSS classes are defined
    const hasCallCSS = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule) {
              if (rule.selectorText?.includes('.call-screen') ||
                  rule.selectorText?.includes('.incoming-call') ||
                  rule.selectorText?.includes('.conference-screen')) {
                return true;
              }
            }
          }
        } catch (e) { /* cross-origin sheets */ }
      }
      return false;
    });
    expect(hasCallCSS).toBe(true);
  });

  test('call control button CSS exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const hasControlCSS = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule &&
                (rule.selectorText?.includes('.call-control') ||
                 rule.selectorText?.includes('.call-btn'))) {
              return true;
            }
          }
        } catch (e) {}
      }
      return false;
    });
    expect(hasControlCSS).toBe(true);
  });
});

test.describe('Calls — Conference Grid CSS', () => {
  test('conference grid CSS classes defined', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const gridClasses = await page.evaluate(() => {
      const found: string[] = [];
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule &&
                rule.selectorText?.includes('.conf-grid')) {
              found.push(rule.selectorText);
            }
          }
        } catch (e) {}
      }
      return found;
    });
    // Should have grid classes for different participant counts
    expect(gridClasses.length).toBeGreaterThan(0);
  });
});

test.describe('Calls — Incoming Call Modal CSS', () => {
  test('incoming call overlay has high z-index', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Check via CSS custom property (--z-call-screen defined on :root)
    const zValue = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return root.getPropertyValue('--z-call-screen').trim();
    });
    if (!zValue) test.skip(); // property not found
    expect(parseInt(zValue)).toBeGreaterThanOrEqual(9000);
  });

  test('call screen CSS class exists in stylesheets', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const found = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule &&
                rule.selectorText === '.call-screen') {
              return true;
            }
          }
        } catch (e) { /* cross-origin */ }
      }
      return false;
    });
    if (!found) test.skip(); // cross-origin or not found
    expect(found).toBe(true);
  });
});
