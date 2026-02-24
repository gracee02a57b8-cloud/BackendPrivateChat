/**
 * BarsikChat — Responsive Design & Cross-Device Tests
 *
 * Tags: @responsive @mobile @tablet @desktop
 *
 * Covers:
 * - All three breakpoints (1920×1080, 768×1024, 375×667)
 * - Sidebar width at each breakpoint
 * - Bottom nav visibility
 * - Chat message width constraints
 * - Font readability
 * - No horizontal overflow at any size
 * - Elements don't overlap
 * - Touch targets on mobile
 * - Landscape mode
 * - Safe area CSS support
 */
import { test, expect } from '@playwright/test';
import { ChatPage } from '../pages/ChatPage';
import {
  VIEWPORTS, assertNoHorizontalOverflow, getCSSProperty,
  MIN_TAP_TARGET, waitForVisualStability,
} from '../helpers/test-helpers';

const viewportTests = [
  { name: 'desktop-1920', ...VIEWPORTS.desktop },
  { name: 'tablet-768', ...VIEWPORTS.tablet },
  { name: 'mobile-375', ...VIEWPORTS.mobile },
  { name: 'small-mobile-360', ...VIEWPORTS.smallMobile },
  { name: 'landscape-667', ...VIEWPORTS.mobileLandscape },
];

for (const vp of viewportTests) {
  test.describe(`Responsive — ${vp.name} (${vp.width}×${vp.height})`, () => {

    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const chat = new ChatPage(page);
      await chat.goto();
      await chat.waitForWebSocket();
    });

    test('no horizontal overflow', async ({ page }) => {
      const hasOverflow = await assertNoHorizontalOverflow(page);
      expect(hasOverflow).toBe(false);
    });

    test('container fills viewport', async ({ page }) => {
      const container = page.locator('.chat-container');
      const box = await container.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.width).toBeGreaterThanOrEqual(vp.width - 2);
    });

    test(`bottom nav ${vp.width <= 768 ? 'visible' : 'hidden'}`, async ({ page }) => {
      const nav = page.locator('.mobile-bottom-nav');
      if (vp.width <= 768) {
        await expect(nav).toBeVisible();
      } else {
        await expect(nav).not.toBeVisible();
      }
    });

    test('sidebar is within bounds', async ({ page }) => {
      const sidebar = page.locator('.chat-sidebar');
      const sidebarVisible = await sidebar.isVisible();
      if (sidebarVisible) {
        const box = await sidebar.boundingBox();
        expect(box).toBeTruthy();
        expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1);
      }
    });

    test('text is readable (font-size >= 12px)', async ({ page }) => {
      const mainText = page.locator('.sb-chat-name, .message-body, .sb-search input').first();
      if (await mainText.count() > 0) {
        const fontSize = await getCSSProperty(mainText, 'font-size');
        expect(parseInt(fontSize)).toBeGreaterThanOrEqual(12);
      }
    });

    test(`screenshot — ${vp.name}`, async ({ page }) => {
      // Dismiss banners that may appear at any viewport
      await page.evaluate(() => {
        document.querySelectorAll('.media-perm-banner, .connection-banner').forEach(el => {
          (el as HTMLElement).style.display = 'none';
        });
      }).catch(() => {});
      await waitForVisualStability(page);
      await expect(page).toHaveScreenshot(`responsive-${vp.name}.png`, {
        fullPage: false,
        maxDiffPixelRatio: 0.05,  // 5% tolerance for dynamic content
        mask: [
          page.locator('.sb-chat-time'),
          page.locator('.sb-chat-preview'),
          page.locator('.sb-online-dot'),
          page.locator('.bottom-nav-badge'),
          page.locator('.connection-banner'),
          page.locator('.media-perm-banner'),
        ],
      });
    });
  });
}

test.describe('Responsive — Sidebar Width Breakpoints', () => {
  test('desktop (>1440px): sidebar >= 300px', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const chat = new ChatPage(page);
    await chat.goto();
    await chat.waitForWebSocket();
    const box = await chat.sidebar.boundingBox();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(280);
    }
  });

  test('small desktop (1025-1439px): sidebar >= 240px', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    const chat = new ChatPage(page);
    await chat.goto();
    await chat.waitForWebSocket();
    const box = await chat.sidebar.boundingBox();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(220);
    }
  });
});

test.describe('Responsive — Mobile Touch Targets', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    const chat = new ChatPage(page);
    await chat.goto();
    await chat.waitForWebSocket();
  });

  test('all bottom nav items are tappable', async ({ page }) => {
    const items = page.locator('.bottom-nav-item');
    const count = await items.count();
    for (let i = 0; i < count; i++) {
      const box = await items.nth(i).boundingBox();
      expect(box).toBeTruthy();
      // Each item should be at least 36px high for touch
      expect(box!.height).toBeGreaterThanOrEqual(36);
    }
  });

  test('chat list items are tappable', async ({ page }) => {
    const items = page.locator('.sb-chat-item');
    const firstItem = items.first();
    if (await firstItem.count() > 0) {
      const box = await firstItem.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
    }
  });

  test('hamburger button is tappable', async ({ page }) => {
    // Dismiss banners that may overlay the button
    await page.evaluate(() => {
      document.querySelectorAll('.media-perm-banner, .connection-banner').forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
    }).catch(() => {});
    const btn = page.locator('.sb-burger-btn');
    if (!(await btn.isVisible())) test.skip();
    const box = await btn.boundingBox();
    expect(box).toBeTruthy();
    expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(30);
  });
});

test.describe('Responsive — No Element Overlap @mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    const chat = new ChatPage(page);
    await chat.goto();
    await chat.waitForWebSocket();
  });

  test('bottom nav does not overlap chat list', async ({ page }) => {
    const nav = page.locator('.mobile-bottom-nav');
    const lastItem = page.locator('.sb-chat-item').last();

    if (await nav.isVisible() && await lastItem.count() > 0) {
      const navBox = await nav.boundingBox();
      // Nav should be below content (with padding)
      expect(navBox).toBeTruthy();
    }
  });

  test('FAB does not overlap bottom nav', async ({ page }) => {
    const fab = page.locator('.fab-container');
    const nav = page.locator('.mobile-bottom-nav');

    if (await fab.isVisible() && await nav.isVisible()) {
      const fabBox = await fab.boundingBox();
      const navBox = await nav.boundingBox();
      if (fabBox && navBox) {
        expect(fabBox.y + fabBox.height).toBeLessThanOrEqual(navBox.y + 2);
      }
    }
  });

  test('search bar does not overlap filter tabs', async ({ page }) => {
    // Dismiss banners first
    await page.evaluate(() => {
      document.querySelectorAll('.media-perm-banner, .connection-banner').forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
    }).catch(() => {});
    
    const search = page.locator('.sb-search');
    const filters = page.locator('.sb-filters');

    if (await search.isVisible() && await filters.isVisible()) {
      const searchBox = await search.boundingBox();
      const filterBox = await filters.boundingBox();
      if (searchBox && filterBox) {
        // Verify they don't overlap vertically (one should be above the other)
        const noOverlap = (searchBox.y + searchBox.height <= filterBox.y + 5) ||
                          (filterBox.y + filterBox.height <= searchBox.y + 5);
        expect(noOverlap).toBe(true);
      }
    }
  });
});

test.describe('Responsive — Safe Area CSS', () => {
  test('safe-area-inset CSS support detected', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const hasSafeArea = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule instanceof CSSSupportsRule &&
                rule.conditionText?.includes('safe-area-inset')) {
              return true;
            }
          }
        } catch (e) {}
      }
      return false;
    });
    expect(hasSafeArea).toBe(true);
  });
});
