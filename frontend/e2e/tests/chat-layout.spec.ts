/**
 * BarsikChat — Chat Layout Tests (Sidebar + Chat Area)
 *
 * Tags: @smoke @chat @layout
 *
 * Covers:
 * - Desktop: sidebar + chat area side-by-side
 * - Mobile: sidebar full-screen, chat full-screen (back button)
 * - Chat list items: avatar, name, last message, time, unread badge
 * - Search bar visibility
 * - Hamburger menu
 * - Filter tabs
 * - No horizontal overflow
 * - Visual regression
 */
import { test, expect } from '@playwright/test';
import { ChatPage } from '../pages/ChatPage';
import {
  waitForVisualStability, assertNoHorizontalOverflow,
  getCSSProperty, MOBILE_BREAKPOINT, MIN_TAP_TARGET,
} from '../helpers/test-helpers';

test.describe('Chat Layout — Desktop', () => {
  let chat: ChatPage;

  test.beforeEach(async ({ page }) => {
    chat = new ChatPage(page);
    await chat.goto();
    await chat.waitForWebSocket();
  });

  test('@smoke chat container renders', async () => {
    await expect(chat.container).toBeVisible();
  });

  test('sidebar is visible on desktop', async ({ page }) => {
    if (chat.isMobile()) test.skip();
    await expect(chat.sidebar).toBeVisible();
    const box = await chat.sidebar.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThanOrEqual(200);
  });

  test('sidebar and chat area are side-by-side on desktop', async ({ page }) => {
    if (chat.isMobile()) test.skip();
    const sidebarBox = await chat.sidebar.boundingBox();
    const containerBox = await chat.container.boundingBox();
    expect(sidebarBox).toBeTruthy();
    expect(containerBox).toBeTruthy();
    // Sidebar should be on the left
    expect(sidebarBox!.x).toBeLessThan(containerBox!.width / 2);
  });

  test('search bar is visible', async () => {
    await expect(chat.searchInput).toBeVisible();
  });

  test('hamburger button is visible', async () => {
    if (chat.isMobile()) test.skip(); // burger is only in desktop sidebar
    await expect(chat.burgerButton).toBeVisible();
  });

  test('filter tabs are visible', async () => {
    await expect(chat.filterTabs).toBeVisible();
  });

  test('chat list renders (may be empty for new user)', async () => {
    await expect(chat.chatList).toBeVisible({ timeout: 10_000 });
    // New users may have 0 rooms; that's OK — just verify the list container exists
  });
});

test.describe('Chat Layout — Chat List Items', () => {
  let chat: ChatPage;

  test.beforeEach(async ({ page }) => {
    chat = new ChatPage(page);
    await chat.goto();
    await chat.waitForWebSocket();
  });

  test('chat list item has proper structure', async () => {
    const count = await chat.chatListItems.count();
    if (count === 0) test.skip();
    const firstItem = chat.chatListItems.first();
    await expect(firstItem).toBeVisible({ timeout: 10_000 });

    // Should have avatar section
    const avatar = firstItem.locator('.sb-chat-avatar, .avatar-circle');
    await expect(avatar.first()).toBeVisible();

    // Should have name
    const name = firstItem.locator('.sb-chat-name');
    await expect(name).toBeVisible();
  });

  test('chat list items have minimum tap target', async () => {
    const count = await chat.chatListItems.count();
    if (count === 0) test.skip();
    const firstItem = chat.chatListItems.first();
    await expect(firstItem).toBeVisible({ timeout: 10_000 });
    const box = await firstItem.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
  });
});

test.describe('Chat Layout — Open Chat Room', () => {
  let chat: ChatPage;

  test.beforeEach(async ({ page }) => {
    chat = new ChatPage(page);
    await chat.goto();
    await chat.waitForWebSocket();
  });

  test('clicking first room opens chat room', async () => {
    const count = await chat.chatListItems.count();
    if (count === 0) test.skip();
    await chat.chatListItems.first().click();
    await expect(chat.chatHeader).toBeVisible();
    await expect(chat.messageForm).toBeVisible();
    await expect(chat.messageInput).toBeVisible();
  });

  test('chat header shows room name after opening', async () => {
    const count = await chat.chatListItems.count();
    if (count === 0) test.skip();
    await chat.chatListItems.first().click();
    await expect(chat.chatHeader).toBeVisible();
    // Header text should not be empty
    const text = await chat.chatHeader.innerText();
    expect(text.length).toBeGreaterThan(0);
  });

  test('message input visible in opened room', async () => {
    const count = await chat.chatListItems.count();
    if (count === 0) test.skip();
    await chat.chatListItems.first().click();
    await expect(chat.messageInput).toBeVisible();
  });

  test('send button exists in opened room', async () => {
    const count = await chat.chatListItems.count();
    if (count === 0) test.skip();
    await chat.chatListItems.first().click();
    await expect(chat.sendButton).toBeVisible();
  });
});

test.describe('Chat Layout — Mobile Navigation @mobile', () => {
  let chat: ChatPage;

  test.beforeEach(async ({ page }) => {
    chat = new ChatPage(page);
    await chat.goto();
    await chat.waitForWebSocket();
  });

  test('bottom nav is visible on mobile', async ({ page }) => {
    if (!chat.isMobile()) test.skip();
    await expect(chat.bottomNav).toBeVisible();
  });

  test('bottom nav has 5 tabs', async ({ page }) => {
    if (!chat.isMobile()) test.skip();
    await expect(chat.bottomNavItems).toHaveCount(5);
  });

  test('bottom nav labels are correct', async ({ page }) => {
    if (!chat.isMobile()) test.skip();
    const labels = ['Чаты', 'Контакты', 'Песочница', 'AI', 'Профиль'];
    for (let i = 0; i < labels.length; i++) {
      await expect(chat.bottomNavItems.nth(i)).toContainText(labels[i]);
    }
  });

  test('bottom nav is hidden on desktop', async ({ page }) => {
    if (chat.isMobile()) test.skip();
    await expect(chat.bottomNav).not.toBeVisible();
  });

  test('mobile: back button appears in chat room', async ({ page }) => {
    if (!chat.isMobile()) test.skip();
    const count = await chat.chatListItems.count();
    if (count === 0) test.skip();
    await chat.chatListItems.first().click();
    await expect(chat.backButton).toBeVisible();
  });

  test('mobile: bottom nav hidden when in chat room', async ({ page }) => {
    if (!chat.isMobile()) test.skip();
    const count = await chat.chatListItems.count();
    if (count === 0) test.skip();
    await chat.chatListItems.first().click();
    await expect(chat.bottomNav).not.toBeVisible();
  });

  test('mobile: back button returns to sidebar', async ({ page }) => {
    if (!chat.isMobile()) test.skip();
    const count = await chat.chatListItems.count();
    if (count === 0) test.skip();
    await chat.chatListItems.first().click();
    await chat.backButton.click();
    await expect(chat.sidebar).toBeVisible();
  });

  test('mobile: tab switching works', async ({ page }) => {
    if (!chat.isMobile()) test.skip();
    await chat.switchMobileTab('contacts');
    // Contacts tab should show contact list or user list
    await page.waitForTimeout(500);
    await chat.switchMobileTab('ai');
    await expect(page.locator('.ai-chat-page')).toBeVisible();
    await chat.switchMobileTab('chats');
  });
});

test.describe('Chat Layout — Floating Bottom Nav CSS @mobile', () => {
  let chat: ChatPage;

  test.beforeEach(async ({ page }) => {
    chat = new ChatPage(page);
    await chat.goto();
    await chat.waitForWebSocket();
  });

  test('bottom nav is floating pill shape', async ({ page }) => {
    if (!chat.isMobile()) test.skip();
    const borderRadius = await getCSSProperty(chat.bottomNav, 'border-radius');
    expect(parseInt(borderRadius)).toBeGreaterThanOrEqual(20);
  });

  test('bottom nav has glassmorphism', async ({ page }) => {
    if (!chat.isMobile()) test.skip();
    const bf = await getCSSProperty(chat.bottomNav, 'backdrop-filter');
    expect(bf).toContain('blur');
  });

  test('bottom nav has margins from screen edges', async ({ page }) => {
    if (!chat.isMobile()) test.skip();
    const box = await chat.bottomNav.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.x).toBeGreaterThanOrEqual(8);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width - 8);
  });

  test('active tab has highlight', async ({ page }) => {
    if (!chat.isMobile()) test.skip();
    const activeItem = chat.bottomNavItems.filter({ hasText: 'Чаты' });
    await expect(activeItem).toHaveClass(/active/);
  });

  test('bottom nav items have adequate tap targets', async ({ page }) => {
    if (!chat.isMobile()) test.skip();
    for (let i = 0; i < 5; i++) {
      const box = await chat.bottomNavItems.nth(i).boundingBox();
      expect(box).toBeTruthy();
      expect(box!.height).toBeGreaterThanOrEqual(36); // compact but tappable
    }
  });
});

test.describe('Chat Layout — No Overflow', () => {
  test.beforeEach(async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.goto();
    await chat.waitForWebSocket();
  });

  test('no horizontal overflow on current viewport', async ({ page }) => {
    const hasOverflow = await assertNoHorizontalOverflow(page);
    expect(hasOverflow).toBe(false);
  });
});

test.describe('Chat Layout — FAB Buttons @mobile', () => {
  let chat: ChatPage;

  test.beforeEach(async ({ page }) => {
    chat = new ChatPage(page);
    await chat.goto();
    await chat.waitForWebSocket();
  });

  test('FAB buttons visible on chats tab (no active room)', async ({ page }) => {
    if (!chat.isMobile()) test.skip();
    await expect(chat.fabContainer).toBeVisible({ timeout: 5_000 });
    await expect(chat.fabStory).toBeVisible();
    await expect(chat.fabChat).toBeVisible();
  });

  test('FAB buttons above bottom nav', async ({ page }) => {
    if (!chat.isMobile()) test.skip();
    const fabBox = await chat.fabContainer.boundingBox();
    const navBox = await chat.bottomNav.boundingBox();
    if (fabBox && navBox) {
      // FAB should be above the nav bar
      expect(fabBox.y + fabBox.height).toBeLessThanOrEqual(navBox.y + 5);
    }
  });
});

test.describe('Chat Layout — Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.goto();
    await chat.waitForWebSocket();
  });

  test('sidebar screenshot', async ({ page }) => {
    // Dismiss dynamic banners
    await page.evaluate(() => {
      document.querySelectorAll('.media-perm-banner, .connection-banner').forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
    }).catch(() => {});
    await waitForVisualStability(page);
    await expect(page).toHaveScreenshot('chat-sidebar.png', {
      maxDiffPixelRatio: 0.05,
      mask: [
        page.locator('.sb-chat-time'),         // dynamic timestamps
        page.locator('.sb-chat-preview'),       // dynamic messages
        page.locator('.sb-online-dot'),         // online status changes
        page.locator('.bottom-nav-badge'),      // unread counts
        page.locator('.connection-banner'),
        page.locator('.media-perm-banner'),
      ],
    });
  });
});
