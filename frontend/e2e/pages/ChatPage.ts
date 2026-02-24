/**
 * BarsikChat — Page Object Model: Chat Page (main app)
 */
import { type Page, type Locator, expect } from '@playwright/test';

export class ChatPage {
  readonly page: Page;

  // Layout
  readonly container: Locator;
  readonly sidebar: Locator;
  readonly chatArea: Locator;
  readonly chatHeader: Locator;

  // Sidebar
  readonly chatList: Locator;
  readonly chatListItems: Locator;
  readonly searchInput: Locator;
  readonly burgerButton: Locator;
  readonly burgerDrawer: Locator;
  readonly sidebarTabs: Locator;
  readonly filterTabs: Locator;

  // Chat Room
  readonly messagesContainer: Locator;
  readonly messageInput: Locator;
  readonly sendButton: Locator;
  readonly messages: Locator;
  readonly messageForm: Locator;
  readonly backButton: Locator;
  readonly pinnedBar: Locator;

  // Bottom Navigation (mobile)
  readonly bottomNav: Locator;
  readonly bottomNavItems: Locator;
  readonly bottomNavBadge: Locator;

  // E2E Encryption
  readonly e2eToggle: Locator;
  readonly e2eIndicator: Locator;
  readonly securityCodeModal: Locator;

  // Modals
  readonly confirmModal: Locator;
  readonly emojiPicker: Locator;
  readonly profileModal: Locator;

  // FAB
  readonly fabContainer: Locator;
  readonly fabStory: Locator;
  readonly fabChat: Locator;

  // Notifications
  readonly messageNotification: Locator;
  readonly replyNotification: Locator;
  readonly taskNotification: Locator;
  readonly toast: Locator;

  // Connection
  readonly connectionBanner: Locator;

  // Call
  readonly callScreen: Locator;
  readonly incomingCallModal: Locator;
  readonly conferenceScreen: Locator;

  // Stories
  readonly storiesBar: Locator;
  readonly storyViewer: Locator;
  readonly storyUploadModal: Locator;

  constructor(page: Page) {
    this.page = page;

    // Layout
    this.container = page.locator('.chat-container');
    this.sidebar = page.locator('.chat-sidebar');
    this.chatArea = page.locator('.chat-main');
    this.chatHeader = page.locator('.chat-header');

    // Sidebar
    this.chatList = page.locator('.sb-chat-list');
    this.chatListItems = page.locator('.sb-chat-item');
    this.searchInput = page.locator('.sb-search input');
    this.burgerButton = page.locator('.sb-burger-btn');
    this.burgerDrawer = page.locator('.burger-drawer');
    this.sidebarTabs = page.locator('.sb-tabs');
    this.filterTabs = page.locator('.sb-filters');

    // Chat Room
    this.messagesContainer = page.locator('.messages');
    this.messageInput = page.locator('.message-form textarea');
    this.sendButton = page.locator('.action-btn.send-btn');
    this.messages = page.locator('.message');
    this.messageForm = page.locator('.message-form');
    this.backButton = page.locator('.chat-header-back');
    this.pinnedBar = page.locator('.pinned-bar');

    // Bottom Navigation
    this.bottomNav = page.locator('.mobile-bottom-nav');
    this.bottomNavItems = page.locator('.bottom-nav-item');
    this.bottomNavBadge = page.locator('.bottom-nav-badge');

    // E2E
    this.e2eToggle = page.locator('.e2e-toggle');
    this.e2eIndicator = page.locator('.e2e-indicator');
    this.securityCodeModal = page.locator('.security-code-modal');

    // Modals
    this.confirmModal = page.locator('.confirm-overlay');
    this.emojiPicker = page.locator('.emoji-picker');
    this.profileModal = page.locator('.profile-modal');

    // FAB
    this.fabContainer = page.locator('.fab-container');
    this.fabStory = page.locator('.fab.fab-story');
    this.fabChat = page.locator('.fab.fab-chat');

    // Notifications
    this.messageNotification = page.locator('.msg-notif-popup');
    this.replyNotification = page.locator('.reply-notif-popup');
    this.taskNotification = page.locator('.task-notif-popup');
    this.toast = page.locator('.toast');

    // Connection
    this.connectionBanner = page.locator('.connection-banner');

    // Call
    this.callScreen = page.locator('.call-screen');
    this.incomingCallModal = page.locator('.incoming-call-overlay');
    this.conferenceScreen = page.locator('.conference-screen');

    // Stories
    this.storiesBar = page.locator('.stories-bar');
    this.storyViewer = page.locator('.story-viewer');
    this.storyUploadModal = page.locator('.story-upload-modal');
  }

  async goto() {
    await this.page.goto('/');
    await expect(this.container).toBeVisible({ timeout: 15_000 });
    await this.dismissBanners();
  }

  async waitForWebSocket() {
    // Wait until WebSocket connects (sidebar loads rooms)
    await this.page.waitForTimeout(3000);
    await this.dismissBanners();
  }

  /** Dismiss connection / media-permission banners that may overlay UI */
  async dismissBanners() {
    // Force-hide any overlay banners that block interaction
    await this.page.evaluate(() => {
      document.querySelectorAll('.media-perm-banner, .connection-banner').forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });
    }).catch(() => {});
    await this.page.waitForTimeout(300);
  }

  async openRoom(roomName: string) {
    await this.chatListItems.filter({ hasText: roomName }).first().click();
    await expect(this.chatHeader).toBeVisible();
  }

  async sendMessage(text: string) {
    await this.messageInput.fill(text);
    await this.sendButton.click();
  }

  async switchMobileTab(tab: 'chats' | 'contacts' | 'settings' | 'ai' | 'profile') {
    const labels: Record<string, string> = {
      chats: 'Чаты',
      contacts: 'Контакты',
      settings: 'Песочница',
      ai: 'AI',
      profile: 'Профиль',
    };
    await this.bottomNavItems.filter({ hasText: labels[tab] }).click();
  }

  /** Check viewport is mobile (<= 768px) */
  isMobile(): boolean {
    return (this.page.viewportSize()?.width ?? 1920) <= 768;
  }
}
