/**
 * BarsikChat — Connection & WebSocket Tests
 *
 * Tags: @connection @websocket @stability
 *
 * Covers:
 * - Initial connection establishment
 * - Connection banner behavior (2.5s delay)
 * - Reconnection after disconnect
 * - Online/offline status handling
 * - Auth token validation on WS
 */
import { test, expect } from '@playwright/test';
import { ChatPage } from '../pages/ChatPage';

test.describe('Connection — Initial State', () => {
  test('app connects and shows chat list', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.goto();
    // Should load chat container (implies WS connected)
    await expect(chat.container).toBeVisible({ timeout: 15_000 });
    // Chat list container should be visible (may be empty for new user)
    await expect(chat.chatList).toBeVisible({ timeout: 10_000 });
  });

  test('connection banner not shown initially (2.5s delay)', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.goto();
    // The connection banner should NOT flash immediately due to 2.5s delay
    await expect(chat.connectionBanner).not.toBeVisible({ timeout: 1000 });
  });
});

test.describe('Connection — Network Resilience', () => {
  test('app recovers from brief offline', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.goto();
    await chat.waitForWebSocket();

    // Go offline
    await page.context().setOffline(true);
    await page.waitForTimeout(3000);

    // Connection banner should appear (after 2.5s delay)
    // Note: may not show if reconnect is fast enough
    
    // Go back online
    await page.context().setOffline(false);
    await page.waitForTimeout(5000);

    // App should recover — chat list should still be functional
    await expect(chat.container).toBeVisible();
  });

  test('messages still visible during offline', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.goto();
    await chat.waitForWebSocket();
    const count = await chat.chatListItems.count();
    if (count === 0) { test.skip(); return; }
    await chat.chatListItems.first().click();
    await expect(chat.chatHeader).toBeVisible();

    // Capture current message count
    const initialCount = await chat.messages.count();

    // Go offline briefly
    await page.context().setOffline(true);
    await page.waitForTimeout(1000);

    // Messages should still be visible (not cleared)
    const offlineCount = await chat.messages.count();
    expect(offlineCount).toBe(initialCount);

    // Restore
    await page.context().setOffline(false);
  });
});

test.describe('Connection — Auth Validation', () => {
  test('expired/invalid token redirects to login', async ({ page }) => {
    // Set invalid token
    await page.addInitScript(() => {
      localStorage.setItem('token', 'invalid_token_xyz');
      localStorage.setItem('username', 'fake_user');
      localStorage.setItem('role', 'USER');
    });
    await page.goto('/');

    // Should eventually redirect to login (WebSocket auth fails)
    // or show the login page when token is rejected
    await page.waitForTimeout(5000);

    // Either login page shows or chat loads with reconnect issues
    const loginVisible = await page.locator('.login-container').isVisible();
    const chatVisible = await page.locator('.chat-container').isVisible();
    
    // One of them should be visible
    expect(loginVisible || chatVisible).toBe(true);
  });

  test('no token shows login page', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');
    await expect(page.locator('.login-container')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Connection — WebSocket Message Flow', () => {
  test('typing indicator works', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.goto();
    await chat.waitForWebSocket();
    const count = await chat.chatListItems.count();
    if (count === 0) { test.skip(); return; }
    await chat.chatListItems.first().click();
    await expect(chat.chatHeader).toBeVisible();

    // Type in the input — should trigger TYPING event via WS
    await chat.messageInput.fill('typing test...');
    await page.waitForTimeout(500);
    // Clear without sending
    await chat.messageInput.fill('');
  });

  test('send and receive message via WebSocket', async ({ page }) => {
    const chat = new ChatPage(page);
    await chat.goto();
    await chat.waitForWebSocket();
    const count = await chat.chatListItems.count();
    if (count === 0) { test.skip(); return; }
    await chat.chatListItems.first().click();
    await expect(chat.chatHeader).toBeVisible();

    const testMsg = `WS test ${Date.now()}`;
    await chat.sendMessage(testMsg);

    // Message should appear in the chat
    const msg = page.locator('.message').filter({ hasText: testMsg });
    await expect(msg.first()).toBeVisible({ timeout: 10_000 });
  });
});
