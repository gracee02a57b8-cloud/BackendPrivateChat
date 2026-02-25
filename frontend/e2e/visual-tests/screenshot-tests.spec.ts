/**
 * BarsikChat — Screenshot Visual Regression Tests
 *
 * Tags: @screenshot @visual-regression
 *
 * Covers every major screen at all 8 viewports:
 *   360×640 · 375×667 · 390×844 · 414×896
 *   768×1024 · 1024×768 · 1920×1080 · 2560×1440
 *
 * Tests every interactive element: buttons, fields, burger,
 * emoji picker, menus, tabs, navigation.
 *
 * Uses expect(page).toHaveScreenshot() with dynamic element masking.
 */
import { test, expect } from '@playwright/test';
import { LoginPage, ChatListPage, ChatWindowPage, ProfilePage } from './pages/index.js';
import {
  waitForVisualStability, dismissBanners, freezeDynamicContent,
  getDefaultMasks, isMobileViewport,
} from './helpers/visual-helpers.js';

/* ═══════════════════════════════════════════════════
 *  1. LOGIN PAGE SCREENSHOTS
 * ═══════════════════════════════════════════════════ */
test.describe('Screenshots — Login Page @screenshot', () => {

  test('login page — default state', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('login-default.png', {
      fullPage: true,
      mask: login.getDynamicMasks(),
    });
  });

  test('login page — username focused', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.usernameInput.click();
    await waitForVisualStability(page, 500);

    await expect(page).toHaveScreenshot('login-username-focused.png', {
      fullPage: true,
      mask: login.getDynamicMasks(),
    });
  });

  test('login page — password focused', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.passwordInput.click();
    await waitForVisualStability(page, 500);

    await expect(page).toHaveScreenshot('login-password-focused.png', {
      fullPage: true,
      mask: login.getDynamicMasks(),
    });
  });

  test('login page — form filled', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.usernameInput.fill('test_user');
    await login.passwordInput.fill('password123');
    await waitForVisualStability(page, 500);

    await expect(page).toHaveScreenshot('login-filled.png', {
      fullPage: true,
      mask: login.getDynamicMasks(),
    });
  });

  test('login page — register mode', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.switchToRegister();
    await waitForVisualStability(page, 500);

    await expect(page).toHaveScreenshot('login-register-mode.png', {
      fullPage: true,
      mask: login.getDynamicMasks(),
    });
  });

  test('login page — error state', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login('nonexistent_user_xyz', 'wrong_pass');
    // Wait for error to appear
    await page.waitForTimeout(3000);
    await waitForVisualStability(page, 500);

    await expect(page).toHaveScreenshot('login-error.png', {
      fullPage: true,
      mask: login.getDynamicMasks(),
    });
  });
});

/* ═══════════════════════════════════════════════════
 *  2. CHAT LIST SCREENSHOTS
 * ═══════════════════════════════════════════════════ */
test.describe('Screenshots — Chat List @screenshot', () => {

  test('chat list — default view', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);
    await freezeDynamicContent(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('chatlist-default.png', {
      fullPage: false,
      mask: getDefaultMasks(page),
    });
  });

  test('chat list — search focused', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);
    await chatList.focusSearch();
    await freezeDynamicContent(page);
    await waitForVisualStability(page, 500);

    await expect(page).toHaveScreenshot('chatlist-search-focused.png', {
      fullPage: false,
      mask: getDefaultMasks(page),
    });
  });

  test('chat list — search with text', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);
    await chatList.search('тест');
    await freezeDynamicContent(page);
    await waitForVisualStability(page, 500);

    await expect(page).toHaveScreenshot('chatlist-search-active.png', {
      fullPage: false,
      mask: getDefaultMasks(page),
    });
  });

  test('chat list — filter "Личные" active', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);
    await chatList.switchFilter('private');
    await freezeDynamicContent(page);
    await waitForVisualStability(page, 500);

    await expect(page).toHaveScreenshot('chatlist-filter-private.png', {
      fullPage: false,
      mask: getDefaultMasks(page),
    });
  });

  test('chat list — filter "Группы" active', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);
    await chatList.switchFilter('groups');
    await freezeDynamicContent(page);
    await waitForVisualStability(page, 500);

    await expect(page).toHaveScreenshot('chatlist-filter-groups.png', {
      fullPage: false,
      mask: getDefaultMasks(page),
    });
  });

  test('chat list — burger drawer open', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    // Burger button may not be visible on all viewports
    if (!(await chatList.burgerButton.isVisible())) { test.skip(); return; }
    await chatList.burgerButton.click();
    await page.waitForTimeout(500);
    await waitForVisualStability(page, 500);

    await expect(page).toHaveScreenshot('chatlist-burger-open.png', {
      fullPage: false,
      mask: [
        ...getDefaultMasks(page),
        page.locator('.burger-user-row img'),
        page.locator('.burger-user-name'),
      ],
    });
  });

  test('chat list — three-dot menu open', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    if (!(await chatList.menuButton.isVisible())) { test.skip(); return; }
    await chatList.menuButton.click();
    await page.waitForTimeout(300);
    await waitForVisualStability(page, 500);

    await expect(page).toHaveScreenshot('chatlist-menu-open.png', {
      fullPage: false,
      mask: getDefaultMasks(page),
    });
  });
});

/* ═══════════════════════════════════════════════════
 *  3. MOBILE-SPECIFIC TABS SCREENSHOTS
 * ═══════════════════════════════════════════════════ */
test.describe('Screenshots — Mobile Tabs @screenshot @mobile', () => {
  test.skip(({ page }) => {
    const vp = page.viewportSize();
    return !vp || vp.width > 768;
  }, 'Only on mobile viewports');

  test('contacts tab', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);
    await chatList.switchMobileTab('contacts');
    await freezeDynamicContent(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('mobile-contacts-tab.png', {
      fullPage: false,
      mask: getDefaultMasks(page),
    });
  });

  test('settings/sandbox tab', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);
    await chatList.switchMobileTab('settings');
    await freezeDynamicContent(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('mobile-settings-tab.png', {
      fullPage: false,
      mask: getDefaultMasks(page),
    });
  });

  test('AI tab', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);
    await chatList.switchMobileTab('ai');
    await freezeDynamicContent(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('mobile-ai-tab.png', {
      fullPage: false,
      mask: getDefaultMasks(page),
    });
  });

  test('profile tab', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);
    await chatList.switchMobileTab('profile');
    await freezeDynamicContent(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('mobile-profile-tab.png', {
      fullPage: false,
      mask: [
        ...getDefaultMasks(page),
        page.locator('.my-profile-avatar img'),
        page.locator('.my-profile-display-name'),
        page.locator('.my-profile-online-status'),
      ],
    });
  });
});

/* ═══════════════════════════════════════════════════
 *  4. CHAT ROOM SCREENSHOTS
 * ═══════════════════════════════════════════════════ */
test.describe('Screenshots — Chat Room @screenshot', () => {

  test('chat room — opened (or empty state)', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const hasRooms = (await chatList.chatItems.count()) > 0;
    if (hasRooms) {
      await chatList.chatItems.first().click();
      await page.waitForTimeout(1500);
    }

    await freezeDynamicContent(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('chatroom-default.png', {
      fullPage: false,
      mask: getDefaultMasks(page),
    });
  });

  test('chat room — input focused (keyboard visible)', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const hasRooms = (await chatList.chatItems.count()) > 0;
    if (!hasRooms) {
      test.skip();
      return;
    }

    await chatList.chatItems.first().click();
    await page.waitForTimeout(1000);

    const chatWindow = new ChatWindowPage(page);
    await chatWindow.focusInput();
    await freezeDynamicContent(page);
    await waitForVisualStability(page, 500);

    await expect(page).toHaveScreenshot('chatroom-input-focused.png', {
      fullPage: false,
      mask: getDefaultMasks(page),
    });
  });

  test('chat room — emoji picker open', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const hasRooms = (await chatList.chatItems.count()) > 0;
    if (!hasRooms) {
      test.skip();
      return;
    }

    await chatList.chatItems.first().click();
    await page.waitForTimeout(1000);

    const chatWindow = new ChatWindowPage(page);
    await chatWindow.openEmojiPicker();
    await waitForVisualStability(page, 500);

    await expect(page).toHaveScreenshot('chatroom-emoji-open.png', {
      fullPage: false,
      mask: getDefaultMasks(page),
    });
  });

  test('chat room — header dots menu open', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const hasRooms = (await chatList.chatItems.count()) > 0;
    if (!hasRooms) {
      test.skip();
      return;
    }

    await chatList.chatItems.first().click();
    await page.waitForTimeout(1000);

    const chatWindow = new ChatWindowPage(page);
    await chatWindow.openHeaderMenu();
    await waitForVisualStability(page, 500);

    await expect(page).toHaveScreenshot('chatroom-header-menu.png', {
      fullPage: false,
      mask: getDefaultMasks(page),
    });
  });

  test('chat room — attach menu open', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const hasRooms = (await chatList.chatItems.count()) > 0;
    if (!hasRooms) {
      test.skip();
      return;
    }

    await chatList.chatItems.first().click();
    await page.waitForTimeout(1000);

    const chatWindow = new ChatWindowPage(page);
    await chatWindow.openAttachMenu();
    await waitForVisualStability(page, 500);

    await expect(page).toHaveScreenshot('chatroom-attach-menu.png', {
      fullPage: false,
      mask: getDefaultMasks(page),
    });
  });
});

/* ═══════════════════════════════════════════════════
 *  5. PROFILE SCREENSHOTS
 * ═══════════════════════════════════════════════════ */
test.describe('Screenshots — Profile @screenshot', () => {

  test('my profile page', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const profile = new ProfilePage(page);
    const vp = page.viewportSize();
    const isMobile = vp && vp.width <= 768;

    if (isMobile) {
      await chatList.switchMobileTab('profile');
    } else {
      // Desktop — use three-dot menu
      if (!(await chatList.menuButton.isVisible())) { test.skip(); return; }
      await chatList.menuButton.click();
      await page.waitForTimeout(300);
      const profileItem = page.locator('.sb-menu-dropdown button').filter({ hasText: /профиль/i });
      if (await profileItem.count() > 0) {
        await profileItem.first().click();
        await page.waitForTimeout(500);
      } else {
        test.skip();
        return;
      }
    }

    await freezeDynamicContent(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('profile-my.png', {
      fullPage: false,
      mask: [
        ...getDefaultMasks(page),
        ...profile.getDynamicMasks(),
      ],
    });
  });

  test('edit profile page', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const profile = new ProfilePage(page);
    const vp = page.viewportSize();
    const isMobile = vp && vp.width <= 768;

    if (isMobile) {
      await chatList.switchMobileTab('profile');
    } else {
      // Desktop — use three-dot menu
      if (!(await chatList.menuButton.isVisible())) { test.skip(); return; }
      await chatList.menuButton.click();
      await page.waitForTimeout(300);
      const profileItem = page.locator('.sb-menu-dropdown button').filter({ hasText: /профиль/i });
      if (await profileItem.count() > 0) {
        await profileItem.first().click();
        await page.waitForTimeout(500);
      } else {
        test.skip();
        return;
      }
    }

    // Navigate to edit profile
    const editBtn = page.locator('.my-profile-action-btn').filter({ hasText: 'Изменить' });
    if (await editBtn.count() > 0) {
      await editBtn.click();
      await page.waitForTimeout(500);
    } else {
      test.skip();
      return;
    }

    await freezeDynamicContent(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('profile-edit.png', {
      fullPage: false,
      mask: [
        ...getDefaultMasks(page),
        ...profile.getDynamicMasks(),
      ],
    });
  });

  test('profile — dots menu open', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const vp = page.viewportSize();
    const isMobile = vp && vp.width <= 768;

    if (isMobile) {
      await chatList.switchMobileTab('profile');
    } else {
      // Desktop — use three-dot menu
      if (!(await chatList.menuButton.isVisible())) { test.skip(); return; }
      await chatList.menuButton.click();
      await page.waitForTimeout(300);
      const profileItem = page.locator('.sb-menu-dropdown button').filter({ hasText: /профиль/i });
      if (await profileItem.count() > 0) {
        await profileItem.first().click();
        await page.waitForTimeout(500);
      } else {
        test.skip();
        return;
      }
    }

    const dotsBtn = page.locator('.my-profile-dots-btn');
    if (await dotsBtn.count() > 0) {
      await dotsBtn.click();
      await page.waitForTimeout(300);
    } else {
      test.skip();
      return;
    }

    await waitForVisualStability(page, 500);

    await expect(page).toHaveScreenshot('profile-dots-menu.png', {
      fullPage: false,
      mask: getDefaultMasks(page),
    });
  });
});
