/**
 * BarsikChat — Percy Visual Regression Integration
 *
 * Tags: @percy @visual-regression
 *
 * Percy (https://percy.io) captures screenshots and compares them
 * against baselines in CI/CD pipeline.
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  Setup:                                                 │
 * │  1. npm install --save-dev @percy/cli @percy/playwright │
 * │  2. Set PERCY_TOKEN env variable                        │
 * │  3. Run: npx percy exec -- npx playwright test          │
 * │         -c playwright-visual.config.ts                  │
 * │         --grep @percy                                   │
 * └─────────────────────────────────────────────────────────┘
 *
 * Percy snapshots are taken at multiple widths simultaneously,
 * making them ideal for cross-viewport visual regression.
 */
import { test, expect } from '@playwright/test';
import { ChatListPage, ProfilePage } from './pages/index.js';
import {
  dismissBanners, freezeDynamicContent, waitForVisualStability,
} from './helpers/visual-helpers.js';

// Percy SDK — conditional import
let percySnapshot: ((page: any, name: string, options?: any) => Promise<void>) | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const percy = require('@percy/playwright');
  percySnapshot = percy.percySnapshot;
} catch {
  // Percy not installed — tests will use toHaveScreenshot fallback
}

/** Take Percy snapshot or fallback to Playwright screenshot */
async function takeSnapshot(page: any, name: string, widths?: number[]) {
  if (percySnapshot) {
    await percySnapshot(page, name, {
      widths: widths || [375, 768, 1280, 1920],
      minHeight: 1024,
      percyCSS: `
        .sb-chat-time, .message-meta, .sb-online-dot,
        .sb-badge, .bottom-nav-badge, .connection-banner,
        .typing-indicator, .media-perm-banner { visibility: hidden !important; }
        img[src*="avatar"], img[src*="upload"] { visibility: hidden !important; }
        *, *::before, *::after {
          animation-duration: 0s !important;
          transition-duration: 0s !important;
        }
      `,
    });
  } else {
    // Fallback: use Playwright's built-in screenshot comparison
    await expect(page).toHaveScreenshot(`percy-${name}.png`, {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    });
  }
}

/* ═══════════════════════════════════════════════════
 *  Percy Snapshots
 * ═══════════════════════════════════════════════════ */
test.describe('Percy — Visual Regression @percy', () => {

  test('Login page', async ({ page }) => {
    await page.goto('/');
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await page.reload();
    await page.locator('.login-container').waitFor({ timeout: 15_000 });
    await waitForVisualStability(page);

    await takeSnapshot(page, 'Login Page');
  });

  test('Login page — register mode', async ({ page }) => {
    await page.goto('/');
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await page.reload();
    await page.locator('.login-container').waitFor({ timeout: 15_000 });
    await page.locator('.login-toggle').click();
    await page.waitForTimeout(500);
    await waitForVisualStability(page);

    await takeSnapshot(page, 'Login Page - Register');
  });

  test('Chat list — default', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);
    await freezeDynamicContent(page);
    await waitForVisualStability(page);

    await takeSnapshot(page, 'Chat List');
  });

  test('Chat list — burger drawer', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);
    if (!(await chatList.burgerButton.isVisible())) { test.skip(); return; }
    await chatList.burgerButton.click();
    await page.waitForTimeout(500);
    await waitForVisualStability(page, 500);

    await takeSnapshot(page, 'Chat List - Burger Drawer');
  });

  test('Chat list — three-dot menu', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);
    if (!(await chatList.menuButton.isVisible())) { test.skip(); return; }
    await chatList.menuButton.click();
    await page.waitForTimeout(300);
    await waitForVisualStability(page, 500);

    await takeSnapshot(page, 'Chat List - Menu Open');
  });

  test('Chat room', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const hasRooms = (await chatList.chatItems.count()) > 0;
    if (!hasRooms) { test.skip(); return; }

    await chatList.chatItems.first().click();
    await page.waitForTimeout(1500);
    await dismissBanners(page);
    await freezeDynamicContent(page);
    await waitForVisualStability(page);

    await takeSnapshot(page, 'Chat Room');
  });

  test('Profile page', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const vp = page.viewportSize()!;
    if (vp.width <= 768) {
      await chatList.switchMobileTab('profile');
    } else {
      // Desktop — use three-dot menu
      const menuBtn = page.locator('.sb-menu-btn');
      if (!(await menuBtn.isVisible())) { test.skip(); return; }
      await menuBtn.click();
      await page.waitForTimeout(300);
      const profileItem = page.locator('.sb-menu-dropdown button').filter({ hasText: /профиль/i });
      if (await profileItem.count() === 0) { test.skip(); return; }
      await profileItem.first().click();
      await page.waitForTimeout(500);
    }

    await freezeDynamicContent(page);
    await waitForVisualStability(page);

    await takeSnapshot(page, 'My Profile');
  });

  test('Contacts tab', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (vp.width > 768) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);
    await chatList.switchMobileTab('contacts');
    await freezeDynamicContent(page);
    await waitForVisualStability(page);

    await takeSnapshot(page, 'Contacts Tab', [375, 414]);
  });

  test('AI tab', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (vp.width > 768) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);
    await chatList.switchMobileTab('ai');
    await freezeDynamicContent(page);
    await waitForVisualStability(page);

    await takeSnapshot(page, 'AI Tab', [375, 414]);
  });
});
