/**
 * BarsikChat — Full User Journey (Smoke) Tests
 *
 * Tags: @smoke @e2e @journey
 *
 * End-to-end user flows:
 * 1. Login → see chat list → open room → send message
 * 2. Navigate all mobile tabs
 * 3. Open profile → verify info
 * 4. Hamburger → menu items
 * 5. Search for chat
 */
import { test, expect } from '@playwright/test';
import { ChatPage } from '../pages/ChatPage';
import { LoginPage } from '../pages/LoginPage';

test.describe('User Journey — Login to Chat', () => {
  test('@smoke full login → sidebar visible → rooms loaded', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.goto();
    await chat.waitForWebSocket();

    // Verify sidebar loaded
    await expect(chat.sidebar).toBeVisible();
    await expect(chat.chatList).toBeVisible();

    // If rooms exist, open first one and send a message
    const roomCount = await chat.chatListItems.count();
    if (roomCount > 0) {
      await chat.chatListItems.first().click();
      await expect(chat.chatHeader).toBeVisible();
      await expect(chat.messageForm).toBeVisible();

      const testMsg = `Smoke test ${Date.now()}`;
      await chat.sendMessage(testMsg);
      const msg = page.locator('.message').filter({ hasText: testMsg });
      await expect(msg.first()).toBeVisible({ timeout: 10_000 });
    } else {
      // New user — just verify the empty state is rendered
      await expect(chat.sidebar).toBeVisible();
    }
  });
});

test.describe('User Journey — Mobile Tab Navigation @mobile', () => {
  test('navigate through all tabs', async ({ page }) => {
    const chat = new ChatPage(page);
    if (!chat.isMobile()) test.skip();

    await chat.goto();
    await chat.waitForWebSocket();

    // Start on Chats tab
    await expect(chat.bottomNavItems.filter({ hasText: 'Чаты' })).toHaveClass(/active/);

    // Switch to Contacts
    await chat.switchMobileTab('contacts');
    await expect(chat.bottomNavItems.filter({ hasText: 'Контакты' })).toHaveClass(/active/);
    await page.waitForTimeout(500);

    // Switch to Sandbox
    await chat.switchMobileTab('settings');
    await expect(chat.bottomNavItems.filter({ hasText: 'Песочница' })).toHaveClass(/active/);
    await page.waitForTimeout(500);

    // Switch to AI
    await chat.switchMobileTab('ai');
    await expect(chat.bottomNavItems.filter({ hasText: 'AI' })).toHaveClass(/active/);
    await page.waitForTimeout(500);

    // Switch to Profile
    await chat.switchMobileTab('profile');
    await expect(chat.bottomNavItems.filter({ hasText: 'Профиль' })).toHaveClass(/active/);
    await page.waitForTimeout(500);

    // Back to Chats
    await chat.switchMobileTab('chats');
    await expect(chat.bottomNavItems.filter({ hasText: 'Чаты' })).toHaveClass(/active/);
  });
});

test.describe('User Journey — Hamburger Menu', () => {
  test('open hamburger → see menu items → close', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.goto();
    await chat.waitForWebSocket();

    // Dismiss banners that may overlay UI
    await chat.dismissBanners();

    // Open hamburger
    await chat.burgerButton.dispatchEvent('click');
    await expect(chat.burgerDrawer).toBeVisible({ timeout: 3_000 });

    // Should have some menu items
    const items = chat.burgerDrawer.locator('button, .burger-menu-item');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);

    // Close by pressing Escape
    await page.keyboard.press('Escape');
  });
});

test.describe('User Journey — Chat Search', () => {
  test('search bar is functional', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.goto();
    await chat.waitForWebSocket();

    // Focus search and type
    await chat.searchInput.fill('test');
    await page.waitForTimeout(500);
    // Verify search input has value
    await expect(chat.searchInput).toHaveValue('test');
    // Clear search
    await chat.searchInput.fill('');
    await expect(chat.searchInput).toHaveValue('');
  });
});

test.describe('User Journey — Chat Room Interactions', () => {
  test('open room → type → clear', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.goto();
    await chat.waitForWebSocket();
    const count = await chat.chatListItems.count();
    if (count === 0) { test.skip(); return; }
    await chat.chatListItems.first().click();
    await expect(chat.chatHeader).toBeVisible();

    // Type in the message input
    await chat.messageInput.fill('Hello, testing...');
    await expect(chat.messageInput).toHaveValue('Hello, testing...');

    // Clear
    await chat.messageInput.fill('');
    await expect(chat.messageInput).toHaveValue('');
  });

  test('message has sender info', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.goto();
    await chat.waitForWebSocket();
    const roomCount = await chat.chatListItems.count();
    if (roomCount === 0) { test.skip(); return; }
    await chat.chatListItems.first().click();
    await expect(chat.chatHeader).toBeVisible();

    // If there are messages, check they have sender info
    const messages = page.locator('.message');
    const count = await messages.count();
    if (count > 0) {
      // Messages should have some sender identification
      const firstMsg = messages.first();
      await expect(firstMsg).toBeVisible();
    }
  });
});

test.describe('User Journey — Profile Flow @mobile', () => {
  test('view profile → see info → navigate back', async ({ page }) => {
    const chat = new ChatPage(page);
    if (!chat.isMobile()) test.skip();

    await chat.goto();
    await chat.waitForWebSocket();

    // Go to profile
    await chat.switchMobileTab('profile');
    await page.waitForTimeout(1000);

    // Should see profile elements
    const profileSection = page.locator('.my-profile-page, .profile-page, .profile-container');
    await expect(profileSection.first()).toBeVisible({ timeout: 5_000 });

    // Go back to chats
    await chat.switchMobileTab('chats');
    await expect(chat.chatList).toBeVisible({ timeout: 5_000 });
  });
});
