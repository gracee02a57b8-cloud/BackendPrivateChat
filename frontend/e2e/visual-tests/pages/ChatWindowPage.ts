/**
 * BarsikChat — Page Object: Chat Window (ChatRoom)
 *
 * Covers: message area, input form, header, emoji picker,
 * attachments, reactions, context menu, scroll-to-bottom
 */
import { type Page, type Locator, expect } from '@playwright/test';

export class ChatWindowPage {
  readonly page: Page;

  /* ── Layout ── */
  readonly chatMain: Locator;

  /* ── Header ── */
  readonly header: Locator;
  readonly backButton: Locator;
  readonly headerAvatar: Locator;
  readonly headerInfo: Locator;
  readonly headerTitle: Locator;
  readonly headerStatus: Locator;
  readonly dotsButton: Locator;
  readonly headerDropdown: Locator;
  readonly callButton: Locator;

  /* ── Messages ── */
  readonly messagesContainer: Locator;
  readonly messages: Locator;
  readonly ownMessages: Locator;
  readonly otherMessages: Locator;
  readonly systemMessages: Locator;
  readonly messageBubble: Locator;
  readonly messageBody: Locator;
  readonly messageMeta: Locator;
  readonly dateDivider: Locator;
  readonly emptyChat: Locator;
  readonly typingIndicator: Locator;

  /* ── Scroll ── */
  readonly scrollToBottom: Locator;

  /* ── Input Form ── */
  readonly messageForm: Locator;
  readonly messageInput: Locator;
  readonly sendButton: Locator;
  readonly attachButton: Locator;
  readonly emojiButton: Locator;
  readonly micButton: Locator;
  readonly plusMenu: Locator;

  /* ── Emoji Picker ── */
  readonly emojiPicker: Locator;
  readonly emojiSearch: Locator;
  readonly emojiCategories: Locator;
  readonly emojiGrid: Locator;

  /* ── Banners ── */
  readonly editBanner: Locator;
  readonly replyBanner: Locator;
  readonly pinnedBar: Locator;

  /* ── Context Menu ── */
  readonly contextMenu: Locator;
  readonly contextReactions: Locator;

  /* ── Multi-select ── */
  readonly multiSelectBar: Locator;

  /* ── Search ── */
  readonly chatSearchBar: Locator;

  constructor(page: Page) {
    this.page = page;

    // Layout
    this.chatMain = page.locator('.chat-main');

    // Header
    this.header = page.locator('.chat-header');
    this.backButton = page.locator('.chat-header-back');
    this.dotsButton = page.locator('.chat-header-dots-btn');
    this.headerAvatar = page.locator('.chat-header-avatar');
    this.headerInfo = page.locator('.chat-header-info');
    this.headerTitle = page.locator('.chat-header-title');
    this.headerStatus = page.locator('.chat-header-status');
    this.headerDropdown = page.locator('.chat-header-dropdown');
    this.callButton = page.locator('.call-header-btn');

    // Messages
    this.messagesContainer = page.locator('.messages');
    this.messages = page.locator('.message');
    this.ownMessages = page.locator('.message.own');
    this.otherMessages = page.locator('.message.other');
    this.systemMessages = page.locator('.message.system');
    this.messageBubble = page.locator('.message-bubble');
    this.messageBody = page.locator('.message-body');
    this.messageMeta = page.locator('.message-meta');
    this.dateDivider = page.locator('.date-divider');
    this.emptyChat = page.locator('.empty-chat');
    this.typingIndicator = page.locator('.typing-indicator');

    // Scroll
    this.scrollToBottom = page.locator('.scroll-to-bottom');

    // Input
    this.messageForm = page.locator('.message-form');
    this.sendButton = page.locator('.send-btn');
    this.messageInput = page.locator('.message-form textarea');
    this.attachButton = page.locator('.attach-btn');
    this.emojiButton = page.locator('.emoji-btn');
    this.micButton = page.locator('.mic-btn');
    this.plusMenu = page.locator('.plus-menu-dropdown');

    // Emoji
    this.emojiPicker = page.locator('.emoji-picker');
    this.emojiSearch = page.locator('.emoji-search input');
    this.emojiCategories = page.locator('.emoji-cat-btn');
    this.emojiGrid = page.locator('.emoji-grid');

    // Banners
    this.editBanner = page.locator('.edit-banner');
    this.replyBanner = page.locator('.reply-banner');
    this.pinnedBar = page.locator('.pinned-bar');

    // Context menu
    this.contextMenu = page.locator('.context-menu');
    this.contextReactions = page.locator('.ctx-reactions');

    // Multi-select
    this.multiSelectBar = page.locator('.multi-select-bar');

    // Search
    this.chatSearchBar = page.locator('.chat-search-bar');
  }

  /** Wait for chat room to be fully loaded */
  async waitForRoom() {
    await expect(this.header).toBeVisible({ timeout: 10_000 });
    await expect(this.messageForm).toBeVisible();
  }

  /** Send a text message */
  async sendMessage(text: string) {
    await this.messageInput.fill(text);
    await this.sendButton.click();
    await this.page.waitForTimeout(500);
  }

  /** Click back button (mobile) */
  async goBack() {
    await this.backButton.click();
    await this.page.waitForTimeout(500);
  }

  /** Open header dots menu */
  async openHeaderMenu() {
    await this.dotsButton.click();
    await expect(this.headerDropdown).toBeVisible();
  }

  /** Open emoji picker */
  async openEmojiPicker() {
    await this.emojiButton.click();
    await expect(this.emojiPicker).toBeVisible();
  }

  /** Close emoji picker */
  async closeEmojiPicker() {
    await this.emojiButton.click();
    await this.page.waitForTimeout(300);
  }

  /** Open attach menu */
  async openAttachMenu() {
    await this.attachButton.click();
    await expect(this.plusMenu).toBeVisible();
  }

  /** Focus message input */
  async focusInput() {
    await this.messageInput.click();
    await expect(this.messageInput).toBeFocused();
  }

  /** Open context menu on a message (right-click or long-press) */
  async openContextMenu(messageIndex = 0) {
    const msg = this.messages.nth(messageIndex);
    await msg.click({ button: 'right' });
    await expect(this.contextMenu).toBeVisible();
  }

  /** Get all interactive elements for clickability testing */
  getInteractiveElements(): Locator[] {
    return [
      this.backButton,
      this.dotsButton,
      this.messageInput,
      this.sendButton,
      this.attachButton,
      this.emojiButton,
    ];
  }

  /** Dynamic elements to mask in screenshots */
  getDynamicMasks(): Locator[] {
    return [
      this.messageMeta,
      this.typingIndicator,
      this.page.locator('.sb-online-dot'),
      this.page.locator('.message-checks'),
      this.page.locator('img'),
      this.headerStatus,
      this.dateDivider,
    ];
  }
}
