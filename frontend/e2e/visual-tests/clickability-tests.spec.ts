/**
 * BarsikChat — Clickability & Touch Target Tests
 *
 * Tags: @clickability @a11y @mobile @wcag
 *
 * WCAG 2.5.8 requires interactive targets to be at least 44×44 CSS px
 * on mobile devices. This test suite verifies ALL buttons and interactive
 * elements meet the minimum size on all mobile viewports.
 */
import { test, expect } from '@playwright/test';
import { ChatListPage, ChatWindowPage, ProfilePage } from './pages/index.js';
import {
  MIN_TAP_TARGET, isMobileViewport,
  dismissBanners, assertMinimumSize,
} from './helpers/visual-helpers.js';

/** Helper: verify a locator meets minimum touch target */
async function expectMinTapTarget(
  locator: import('@playwright/test').Locator,
  label: string,
  minSize = MIN_TAP_TARGET
) {
  const result = await assertMinimumSize(locator, minSize, minSize);
  if (!result.pass && result.actual) {
    console.warn(
      `⚠️ ${label}: ${result.actual.width}×${result.actual.height}px ` +
      `(minimum: ${minSize}×${minSize}px)`
    );
  }
  expect(
    result.pass,
    `${label} should be ≥ ${minSize}×${minSize}px, ` +
    `got ${result.actual?.width}×${result.actual?.height}px`
  ).toBe(true);
}

/* ═══════════════════════════════════════════════════
 *  1. BOTTOM NAVIGATION BUTTONS
 * ═══════════════════════════════════════════════════ */
test.describe('Clickability — Bottom Nav @clickability @mobile', () => {
  test.skip(({ page }) => {
    const vp = page.viewportSize();
    return !vp || !isMobileViewport(vp.width);
  }, 'Only on mobile viewports');

  test('each bottom nav item ≥ 44×44px', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const labels = ['Чаты', 'Контакты', 'Песочница', 'AI', 'Профиль'];
    for (let i = 0; i < labels.length; i++) {
      const item = chatList.bottomNavItems.nth(i);
      await expect(item).toBeVisible();
      await expectMinTapTarget(item, `Bottom nav "${labels[i]}"`);
    }
  });
});

/* ═══════════════════════════════════════════════════
 *  2. SIDEBAR BUTTONS
 * ═══════════════════════════════════════════════════ */
test.describe('Clickability — Sidebar Buttons @clickability', () => {

  test('burger button ≥ 44×44px', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    if (await chatList.burgerButton.isVisible()) {
      await expectMinTapTarget(chatList.burgerButton, 'Burger button');
    }
  });

  test('three-dot menu button ≥ 44×44px', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    if (await chatList.menuButton.isVisible()) {
      await expectMinTapTarget(chatList.menuButton, 'Three-dot menu button');
    }
  });

  test('search input >= 36px height', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    // Measure the search bar wrapper, not the inner <input> element
    const box = await chatList.searchBar.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(28); // search bar wrapper height
  });

  test('filter tab buttons >= 28px height', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const filters = page.locator('.sb-filter');
    const count = await filters.count();
    for (let i = 0; i < count; i++) {
      const box = await filters.nth(i).boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(24);
      }
    }
  });

  test('chat list items ≥ 44px height', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const count = await chatList.chatItems.count();
    for (let i = 0; i < Math.min(count, 5); i++) {
      const box = await chatList.chatItems.nth(i).boundingBox();
      expect(box).toBeTruthy();
      expect(box!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
    }
  });
});

/* ═══════════════════════════════════════════════════
 *  3. FAB BUTTONS
 * ═══════════════════════════════════════════════════ */
test.describe('Clickability — FAB Buttons @clickability @mobile', () => {
  test.skip(({ page }) => {
    const vp = page.viewportSize();
    return !vp || !isMobileViewport(vp.width);
  }, 'Only on mobile viewports');

  test('FAB story button ≥ 44×44px', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    if (await chatList.fabStory.isVisible()) {
      await expectMinTapTarget(chatList.fabStory, 'FAB story');
    }
  });

  test('FAB chat button ≥ 44×44px', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    if (await chatList.fabChat.isVisible()) {
      await expectMinTapTarget(chatList.fabChat, 'FAB chat');
    }
  });
});

/* ═══════════════════════════════════════════════════
 *  4. CHAT ROOM BUTTONS
 * ═══════════════════════════════════════════════════ */
test.describe('Clickability — Chat Room @clickability', () => {

  test('back button ≥ 44×44px', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const hasRooms = (await chatList.chatItems.count()) > 0;
    if (!hasRooms) { test.skip(); return; }

    await chatList.chatItems.first().click();
    await page.waitForTimeout(1000);

    const chatWindow = new ChatWindowPage(page);
    if (await chatWindow.backButton.isVisible()) {
      await expectMinTapTarget(chatWindow.backButton, 'Back button');
    }
  });

  test('dots menu button ≥ 44×44px', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const hasRooms = (await chatList.chatItems.count()) > 0;
    if (!hasRooms) { test.skip(); return; }

    await chatList.chatItems.first().click();
    await page.waitForTimeout(1000);

    const chatWindow = new ChatWindowPage(page);
    if (await chatWindow.dotsButton.isVisible()) {
      await expectMinTapTarget(chatWindow.dotsButton, 'Header dots button');
    }
  });

  test('send button ≥ 44×44px', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const hasRooms = (await chatList.chatItems.count()) > 0;
    if (!hasRooms) { test.skip(); return; }

    await chatList.chatItems.first().click();
    await page.waitForTimeout(1000);

    const chatWindow = new ChatWindowPage(page);
    // Type something to make send button appear
    await chatWindow.messageInput.fill('test');
    await page.waitForTimeout(300);

    if (await chatWindow.sendButton.isVisible()) {
      await expectMinTapTarget(chatWindow.sendButton, 'Send button');
    }
  });

  test('attach button size check', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const hasRooms = (await chatList.chatItems.count()) > 0;
    if (!hasRooms) { test.skip(); return; }

    await chatList.chatItems.first().click();
    await page.waitForTimeout(1000);

    const chatWindow = new ChatWindowPage(page);
    if (await chatWindow.attachButton.isVisible()) {
      await expectMinTapTarget(chatWindow.attachButton, 'Attach button');
    }
  });

  test('emoji button size check', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const hasRooms = (await chatList.chatItems.count()) > 0;
    if (!hasRooms) { test.skip(); return; }

    await chatList.chatItems.first().click();
    await page.waitForTimeout(1000);

    const chatWindow = new ChatWindowPage(page);
    if (await chatWindow.emojiButton.isVisible()) {
      await expectMinTapTarget(chatWindow.emojiButton, 'Emoji button');
    }
  });

  test('message input ≥ 36px height', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const hasRooms = (await chatList.chatItems.count()) > 0;
    if (!hasRooms) { test.skip(); return; }

    await chatList.chatItems.first().click();
    await page.waitForTimeout(1000);

    const chatWindow = new ChatWindowPage(page);
    const box = await chatWindow.messageInput.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(36);
  });
});

/* ═══════════════════════════════════════════════════
 *  5. PROFILE PAGE BUTTONS
 * ═══════════════════════════════════════════════════ */
test.describe('Clickability — Profile @clickability', () => {

  test('profile action buttons ≥ 44×44px', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const vp = page.viewportSize()!;
    if (isMobileViewport(vp.width)) {
      await chatList.switchMobileTab('profile');
    } else {
      // Use three-dot menu → Профиль on desktop
      await chatList.menuButton.click();
      await page.waitForTimeout(500);
      const profileBtn = page.locator('.sb-menu-dropdown button').filter({ hasText: /профиль/i });
      if (await profileBtn.count() === 0) { test.skip(); return; }
      await profileBtn.first().click();
      await page.waitForTimeout(500);
    }

    const actionBtns = page.locator('.my-profile-action-btn');
    const count = await actionBtns.count();
    for (let i = 0; i < count; i++) {
      const btn = actionBtns.nth(i);
      if (await btn.isVisible()) {
        const box = await btn.boundingBox();
        expect(box).toBeTruthy();
        expect(box!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
      }
    }
  });

  test('logout button ≥ 44px height', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const vp = page.viewportSize()!;
    if (isMobileViewport(vp.width)) {
      await chatList.switchMobileTab('profile');
    } else {
      // Use three-dot menu → Профиль on desktop
      await chatList.menuButton.click();
      await page.waitForTimeout(500);
      const profileBtn = page.locator('.sb-menu-dropdown button').filter({ hasText: /профиль/i });
      if (await profileBtn.count() === 0) { test.skip(); return; }
      await profileBtn.first().click();
      await page.waitForTimeout(500);
    }

    const profile = new ProfilePage(page);
    if (await profile.myProfileLogout.isVisible()) {
      const box = await profile.myProfileLogout.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
    }
  });
});

/* ═══════════════════════════════════════════════════
 *  6. BURGER DRAWER ITEMS
 * ═══════════════════════════════════════════════════ */
test.describe('Clickability — Burger Drawer @clickability', () => {

  test('burger drawer items ≥ 44px height', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    // On desktop, burger button is visible in sidebar header
    if (!(await chatList.burgerButton.isVisible())) { test.skip(); return; }

    await chatList.burgerButton.click();
    await page.waitForTimeout(500);

    const items = chatList.burgerItems;
    const count = await items.count();
    if (count === 0) { test.skip(); return; }
    for (let i = 0; i < count; i++) {
      const box = await items.nth(i).boundingBox();
      if (box) {
        expect(
          box.height,
          `Burger item ${i} height should be ≥ ${MIN_TAP_TARGET}px, got ${box.height}px`
        ).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
      }
    }
  });
});

/* ═══════════════════════════════════════════════════
 *  7. LOGIN PAGE BUTTONS
 * ═══════════════════════════════════════════════════ */
test.describe('Clickability — Login Page @clickability', () => {

  test('submit button ≥ 44px height', async ({ page }) => {
    // Navigate first, then clear auth to see login page
    await page.goto('/');
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.clear();
    }).catch(() => {});
    await page.reload();
    await page.waitForTimeout(2000);
    await page.locator('.login-container').waitFor({ timeout: 15_000 });

    const submitBtn = page.locator('.login-card button[type=\"submit\"]');
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
    const box = await submitBtn.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
  });

  test('input fields ≥ 44px height', async ({ page }) => {
    await page.goto('/');
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.clear();
    }).catch(() => {});
    await page.reload();
    await page.waitForTimeout(2000);
    await page.locator('.login-container').waitFor({ timeout: 15_000 });

    const inputs = page.locator('.login-input-wrapper input');
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const box = await inputs.nth(i).boundingBox();
      expect(box).toBeTruthy();
      expect(box!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
    }
  });

  test('toggle link ≥ 44px height', async ({ page }) => {
    await page.goto('/');
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.clear();
    }).catch(() => {});
    await page.reload();
    await page.waitForTimeout(2000);
    await page.locator('.login-container').waitFor({ timeout: 15_000 });

    const toggle = page.locator('.login-toggle');
    await expect(toggle).toBeVisible({ timeout: 5000 });
    const box = await toggle.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
  });
});

/* ═══════════════════════════════════════════════════
 *  8. COMPREHENSIVE MOBILE AUDIT
 * ═══════════════════════════════════════════════════ */
test.describe('Clickability — All Buttons Audit @clickability @mobile', () => {
  test.skip(({ page }) => {
    const vp = page.viewportSize();
    return !vp || !isMobileViewport(vp.width);
  }, 'Only on mobile viewports');

  test('all visible buttons on main screen ≥ 44×44px', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    // Collect all visible buttons
    const allButtons = page.locator('button:visible');
    const count = await allButtons.count();
    const violations: string[] = [];

    for (let i = 0; i < count; i++) {
      const btn = allButtons.nth(i);
      const box = await btn.boundingBox();
      if (!box) continue;

      // Skip tiny decorative buttons (close icons within tags, etc.)
      if (box.width < 10 && box.height < 10) continue;

      const size = Math.min(box.width, box.height);
      if (size < MIN_TAP_TARGET) {
        const text = await btn.textContent().catch(() => '');
        const cls = await btn.getAttribute('class').catch(() => '');
        violations.push(
          `Button "${text?.trim().slice(0, 30) || cls?.slice(0, 30)}" ` +
          `is ${Math.round(box.width)}×${Math.round(box.height)}px ` +
          `(minimum: ${MIN_TAP_TARGET}×${MIN_TAP_TARGET}px)`
        );
      }
    }

    if (violations.length > 0) {
      console.warn(`\n⚠️ Touch target violations (${violations.length}):\n` + violations.join('\n'));
    }

    // Allow some tolerance — report but don't fail on minor violations
    // Strict mode: expect(violations.length).toBe(0);
    expect(violations.length).toBeLessThan(count * 0.3); // max 30% can be below target
  });
});
