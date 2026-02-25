/**
 * BarsikChat — Page Object: Chat List (Sidebar)
 *
 * Covers: sidebar, search, filter tabs, chat items, burger menu,
 * bottom navigation, FAB, stories bar, contacts tab
 */
import { type Page, type Locator, expect } from '@playwright/test';

export class ChatListPage {
  readonly page: Page;

  /* ── Layout ── */
  readonly container: Locator;
  readonly sidebar: Locator;
  readonly chatMain: Locator;

  /* ── Sidebar Header ── */
  readonly sidebarHeader: Locator;
  readonly burgerButton: Locator;
  readonly menuButton: Locator;
  readonly menuDropdown: Locator;
  readonly desktopBrand: Locator;
  readonly sidebarTitle: Locator;

  /* ── Search ── */
  readonly searchBar: Locator;
  readonly searchInput: Locator;
  readonly searchIcon: Locator;

  /* ── Filter Tabs ── */
  readonly filterTabs: Locator;
  readonly filterAll: Locator;
  readonly filterPrivate: Locator;
  readonly filterGroups: Locator;

  /* ── Chat List ── */
  readonly chatList: Locator;
  readonly chatItems: Locator;
  readonly chatItemAvatar: Locator;
  readonly chatItemName: Locator;
  readonly chatItemTime: Locator;
  readonly chatItemPreview: Locator;
  readonly chatItemBadge: Locator;
  readonly emptyState: Locator;

  /* ── Bottom Navigation (mobile) ── */
  readonly bottomNav: Locator;
  readonly bottomNavItems: Locator;
  readonly bottomNavBadge: Locator;

  /* ── Burger Drawer ── */
  readonly burgerOverlay: Locator;
  readonly burgerDrawer: Locator;
  readonly burgerItems: Locator;
  readonly burgerUserRow: Locator;

  /* ── FAB ── */
  readonly fabContainer: Locator;
  readonly fabStory: Locator;
  readonly fabChat: Locator;

  /* ── Stories ── */
  readonly storiesBar: Locator;

  /* ── Connection ── */
  readonly connectionBanner: Locator;

  /* ── Contacts Tab ── */
  readonly contactsList: Locator;
  readonly contactItems: Locator;
  readonly contactSearch: Locator;

  /* ── Desktop Hamburger ── */
  readonly desktopHamburger: Locator;
  readonly sidebarOverlay: Locator;

  constructor(page: Page) {
    this.page = page;

    // Layout — data-testid
    this.container = page.locator('.chat-container');
    this.sidebar = page.locator('.chat-sidebar');
    this.chatMain = page.locator('.chat-main');

    // Sidebar header
    this.sidebarHeader = page.locator('.sb-header');
    this.burgerButton = page.locator('.sb-burger-btn');
    this.menuButton = page.locator('.sb-menu-btn');
    this.menuDropdown = page.locator('.sb-menu-dropdown');
    this.desktopBrand = page.locator('.sb-desktop-brand');
    this.sidebarTitle = page.locator('.sb-title');

    // Search
    this.searchBar = page.locator('.sb-search');
    this.searchInput = page.locator('.sb-search input');
    this.searchIcon = page.locator('.sb-search-icon');

    // Filter tabs
    this.filterTabs = page.locator('.sb-filters');
    this.filterAll = page.locator('.sb-filter').filter({ hasText: 'Все' });
    this.filterPrivate = page.locator('.sb-filter').filter({ hasText: 'Личные' });
    this.filterGroups = page.locator('.sb-filter').filter({ hasText: 'Группы' });

    // Chat list
    this.chatList = page.locator('.sb-chat-list');
    this.chatItems = page.locator('.sb-chat-item');
    this.chatItemAvatar = page.locator('.sb-chat-avatar');
    this.chatItemName = page.locator('.sb-chat-name');
    this.chatItemTime = page.locator('.sb-chat-time');
    this.chatItemPreview = page.locator('.sb-chat-preview');
    this.chatItemBadge = page.locator('.sb-badge');
    this.emptyState = page.locator('.sb-empty');

    // Bottom nav
    this.bottomNav = page.locator('.mobile-bottom-nav');
    this.bottomNavItems = page.locator('.bottom-nav-item');
    this.bottomNavBadge = page.locator('.bottom-nav-badge');

    // Burger drawer
    this.burgerOverlay = page.locator('.burger-overlay');
    this.burgerDrawer = page.locator('.burger-drawer');
    this.burgerItems = page.locator('.burger-menu-item');
    this.burgerUserRow = page.locator('.burger-user-row');

    // FAB
    this.fabContainer = page.locator('.fab-container');
    this.fabStory = page.locator('.fab.fab-story');
    this.fabChat = page.locator('.fab.fab-chat');

    // Stories
    this.storiesBar = page.locator('.stories-bar');

    // Connection
    this.connectionBanner = page.locator('.connection-banner');

    // Contacts
    this.contactsList = page.locator('.contacts-list');
    this.contactItems = page.locator('.contact-item');
    this.contactSearch = page.locator('.contacts-search input');

    // Desktop hamburger
    this.desktopHamburger = page.locator('.desktop-only-hamburger');
    this.sidebarOverlay = page.locator('.sidebar-overlay');
  }

  /** Navigate to chat list and wait for WebSocket */
  async goto() {
    await this.page.goto('/');
    await expect(this.container).toBeVisible({ timeout: 15_000 });
    await this.dismissBanners();
    await this.page.waitForTimeout(2000);
  }

  /** Dismiss connection/media banners that overlay UI */
  async dismissBanners() {
    await this.page.evaluate(() => {
      document.querySelectorAll(
        '.media-perm-banner, .connection-banner, .pwa-install-prompt'
      ).forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });
    }).catch(() => {});
    await this.page.waitForTimeout(300);
  }

  /** Open a chat room by name */
  async openRoom(name: string) {
    await this.chatItems.filter({ hasText: name }).first().click();
    await expect(this.page.locator('.chat-header')).toBeVisible();
  }

  /** Switch mobile tab */
  async switchMobileTab(tab: 'chats' | 'contacts' | 'settings' | 'ai' | 'profile') {
    const labels: Record<string, string> = {
      chats: 'Чаты',
      contacts: 'Контакты',
      settings: 'Песочница',
      ai: 'AI',
      profile: 'Профиль',
    };
    await this.bottomNavItems.filter({ hasText: labels[tab] }).click();
    await this.page.waitForTimeout(500);
  }

  /** Open burger drawer */
  async openBurgerDrawer() {
    await this.burgerButton.click();
    await expect(this.burgerDrawer).toBeVisible();
  }

  /** Close burger drawer */
  async closeBurgerDrawer() {
    await this.burgerOverlay.click({ position: { x: 10, y: 10 } });
    await expect(this.burgerDrawer).not.toBeVisible();
  }

  /** Open three-dot menu */
  async openMenu() {
    await this.menuButton.click();
    await expect(this.menuDropdown).toBeVisible();
  }

  /** Click search input */
  async focusSearch() {
    await this.searchInput.click();
    await expect(this.searchInput).toBeFocused();
  }

  /** Search in chat list */
  async search(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  /** Switch filter tab */
  async switchFilter(filter: 'all' | 'private' | 'groups') {
    const filters = { all: this.filterAll, private: this.filterPrivate, groups: this.filterGroups };
    await filters[filter].click();
    await this.page.waitForTimeout(300);
  }

  /** Check viewport is mobile (<= 768px) */
  isMobile(): boolean {
    return (this.page.viewportSize()?.width ?? 1920) <= 768;
  }

  /** Get all interactive elements for clickability testing */
  getInteractiveElements(): Locator[] {
    return [
      this.burgerButton,
      this.menuButton,
      this.searchInput,
      this.filterAll,
      this.filterPrivate,
      this.filterGroups,
    ];
  }

  /** Get mobile-specific interactive elements */
  getMobileInteractiveElements(): Locator[] {
    return [
      ...this.getInteractiveElements(),
      this.fabStory,
      this.fabChat,
    ];
  }

  /** Dynamic elements to mask in screenshots */
  getDynamicMasks(): Locator[] {
    return [
      this.chatItemTime,
      this.chatItemPreview,
      this.chatItemBadge,
      this.page.locator('.sb-online-dot'),
      this.page.locator('.bottom-nav-badge'),
      this.connectionBanner,
      this.page.locator('.media-perm-banner'),
      this.page.locator('img'),
    ];
  }
}
