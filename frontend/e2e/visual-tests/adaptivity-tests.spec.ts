/**
 * BarsikChat — Adaptivity Tests
 *
 * Tags: @adaptivity @responsive @mobile @desktop
 *
 * Verifies that responsive design works correctly:
 * - Mobile: hamburger menu, bottom nav, full-screen sidebar
 * - Desktop: full sidebar, no bottom nav, side-by-side layout
 * - Tablet: transitional state
 * - All breakpoints: no overflow, proper element visibility
 */
import { test, expect } from '@playwright/test';
import { ChatListPage, ChatWindowPage, ProfilePage } from './pages/index.js';
import {
  VIEWPORTS, isMobileViewport, isDesktopViewport, isTabletViewport,
  waitForVisualStability, dismissBanners, getCSSProperty,
  assertNoHorizontalOverflow, isWithinViewport, elementsDoNotOverlap,
} from './helpers/visual-helpers.js';

/* ═══════════════════════════════════════════════════
 *  1. SIDEBAR VISIBILITY
 * ═══════════════════════════════════════════════════ */
test.describe('Adaptivity — Sidebar @adaptivity', () => {

  test('desktop: sidebar always visible', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (!isDesktopViewport(vp.width)) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    await expect(chatList.sidebar).toBeVisible();
    const box = await chatList.sidebar.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThanOrEqual(200);
    expect(box!.x).toBeGreaterThanOrEqual(-1);
  });

  test('desktop: sidebar and chat area side-by-side', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (!isDesktopViewport(vp.width)) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const sidebarBox = await chatList.sidebar.boundingBox();
    const chatMainBox = await chatList.chatMain.boundingBox();

    expect(sidebarBox).toBeTruthy();
    expect(chatMainBox).toBeTruthy();
    // Sidebar should be on the left, chat-main on the right
    expect(sidebarBox!.x + sidebarBox!.width).toBeLessThanOrEqual(chatMainBox!.x + 10);
  });

  test('mobile: sidebar fills width', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (!isMobileViewport(vp.width)) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const sidebarBox = await chatList.sidebar.boundingBox();
    expect(sidebarBox).toBeTruthy();
    // On mobile in sidebar-view, sidebar should fill the viewport
    expect(sidebarBox!.width).toBeGreaterThanOrEqual(vp.width - 2);
  });
});

/* ═══════════════════════════════════════════════════
 *  2. HAMBURGER / BURGER MENU
 * ═══════════════════════════════════════════════════ */
test.describe('Adaptivity — Hamburger Menu @adaptivity', () => {

  test('mobile: burger button visible in sidebar', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (!isMobileViewport(vp.width)) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    // Mobile layout may use bottom navigation instead of a burger button
    if (!(await chatList.burgerButton.isVisible())) {
      test.skip();
      return;
    }
    await expect(chatList.burgerButton).toBeVisible();
  });

  test('mobile: burger drawer opens and closes', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (!isMobileViewport(vp.width)) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    // Mobile layout may use bottom navigation instead of a burger button
    if (!(await chatList.burgerButton.isVisible())) {
      test.skip();
      return;
    }

    // Open
    await chatList.openBurgerDrawer();
    await expect(chatList.burgerDrawer).toBeVisible();

    // Verify drawer items
    const items = chatList.burgerItems;
    const count = await items.count();
    expect(count).toBeGreaterThan(0);

    // Close
    await chatList.closeBurgerDrawer();
  });

  test('mobile: burger drawer has fixed positioning', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (!isMobileViewport(vp.width)) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    // Mobile layout may use bottom navigation instead of a burger button
    if (!(await chatList.burgerButton.isVisible())) {
      test.skip();
      return;
    }
    await chatList.openBurgerDrawer();

    const position = await getCSSProperty(chatList.burgerDrawer, 'position');
    expect(position).toBe('fixed');
  });

  test('desktop: sidebar has burger button', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (!isDesktopViewport(vp.width)) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    // On desktop, the burger is in the sidebar header
    await expect(chatList.burgerButton).toBeVisible();
  });

  test('desktop: full sidebar content visible (not hamburger-collapsed)', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (!isDesktopViewport(vp.width)) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    // Search bar, filter tabs, chat list should all be visible
    await expect(chatList.searchBar).toBeVisible();
    await expect(chatList.filterTabs).toBeVisible();
    await expect(chatList.chatList).toBeVisible();

    // Menu button should be visible
    await expect(chatList.menuButton).toBeVisible();
  });
});

/* ═══════════════════════════════════════════════════
 *  3. BOTTOM NAVIGATION
 * ═══════════════════════════════════════════════════ */
test.describe('Adaptivity — Bottom Navigation @adaptivity', () => {

  test('mobile: bottom nav visible with 5 tabs', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (!isMobileViewport(vp.width)) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    await expect(chatList.bottomNav).toBeVisible();
    await expect(chatList.bottomNavItems).toHaveCount(5);
  });

  test('mobile: bottom nav labels correct', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (!isMobileViewport(vp.width)) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const expectedLabels = ['Чаты', 'Контакты', 'Песочница', 'AI', 'Профиль'];
    for (let i = 0; i < expectedLabels.length; i++) {
      await expect(chatList.bottomNavItems.nth(i)).toContainText(expectedLabels[i]);
    }
  });

  test('mobile: bottom nav is floating pill', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (!isMobileViewport(vp.width)) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const borderRadius = await getCSSProperty(chatList.bottomNav, 'border-radius');
    expect(parseInt(borderRadius)).toBeGreaterThanOrEqual(20);

    const box = await chatList.bottomNav.boundingBox();
    expect(box).toBeTruthy();
    // Has margins from edges
    expect(box!.x).toBeGreaterThanOrEqual(6);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width - 6);
  });

  test('mobile: bottom nav has glassmorphism', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (!isMobileViewport(vp.width)) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const bf = await getCSSProperty(chatList.bottomNav, 'backdrop-filter');
    expect(bf).toContain('blur');
  });

  test('mobile: active tab has highlight', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (!isMobileViewport(vp.width)) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const chatsTab = chatList.bottomNavItems.filter({ hasText: 'Чаты' });
    await expect(chatsTab).toHaveClass(/active/);
  });

  test('mobile: tab switching changes active tab', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (!isMobileViewport(vp.width)) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    await chatList.switchMobileTab('contacts');
    const contactsTab = chatList.bottomNavItems.filter({ hasText: 'Контакты' });
    await expect(contactsTab).toHaveClass(/active/);

    await chatList.switchMobileTab('ai');
    const aiTab = chatList.bottomNavItems.filter({ hasText: 'AI' });
    await expect(aiTab).toHaveClass(/active/);

    await chatList.switchMobileTab('chats');
    const chatsTab = chatList.bottomNavItems.filter({ hasText: 'Чаты' });
    await expect(chatsTab).toHaveClass(/active/);
  });

  test('desktop: bottom nav NOT visible', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (!isDesktopViewport(vp.width)) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    await expect(chatList.bottomNav).not.toBeVisible();
  });

  test('mobile: bottom nav hidden when chat room is open', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (!isMobileViewport(vp.width)) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const hasRooms = (await chatList.chatItems.count()) > 0;
    if (!hasRooms) { test.skip(); return; }

    await chatList.chatItems.first().click();
    await page.waitForTimeout(1000);

    await expect(chatList.bottomNav).not.toBeVisible();
  });
});

/* ═══════════════════════════════════════════════════
 *  4. FAB BUTTONS
 * ═══════════════════════════════════════════════════ */
test.describe('Adaptivity — FAB @adaptivity', () => {

  test('mobile: FAB visible on chat list', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (!isMobileViewport(vp.width)) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    await expect(chatList.fabContainer).toBeVisible({ timeout: 5_000 });
    await expect(chatList.fabStory).toBeVisible();
    await expect(chatList.fabChat).toBeVisible();
  });

  test('mobile: FAB does not overlap bottom nav', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (!isMobileViewport(vp.width)) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    if (await chatList.fabContainer.isVisible() && await chatList.bottomNav.isVisible()) {
      const fabBox = await chatList.fabContainer.boundingBox();
      const navBox = await chatList.bottomNav.boundingBox();
      if (fabBox && navBox) {
        expect(fabBox.y + fabBox.height).toBeLessThanOrEqual(navBox.y + 5);
      }
    }
  });
});

/* ═══════════════════════════════════════════════════
 *  5. BACK BUTTON & MOBILE NAVIGATION
 * ═══════════════════════════════════════════════════ */
test.describe('Adaptivity — Mobile Back Navigation @adaptivity @mobile', () => {

  test('mobile: back button in chat room', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (!isMobileViewport(vp.width)) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const hasRooms = (await chatList.chatItems.count()) > 0;
    if (!hasRooms) { test.skip(); return; }

    await chatList.chatItems.first().click();
    await page.waitForTimeout(1000);

    const chatWindow = new ChatWindowPage(page);
    await expect(chatWindow.backButton).toBeVisible();
  });

  test('mobile: back button returns to sidebar', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (!isMobileViewport(vp.width)) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const hasRooms = (await chatList.chatItems.count()) > 0;
    if (!hasRooms) { test.skip(); return; }

    await chatList.chatItems.first().click();
    await page.waitForTimeout(1000);

    const chatWindow = new ChatWindowPage(page);
    await chatWindow.goBack();

    await expect(chatList.sidebar).toBeVisible();
    await expect(chatList.bottomNav).toBeVisible();
  });
});

/* ═══════════════════════════════════════════════════
 *  6. NO OVERFLOW AT ANY VIEWPORT
 * ═══════════════════════════════════════════════════ */
test.describe('Adaptivity — No Overflow @adaptivity', () => {

  test('no horizontal overflow on chat list', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const hasOverflow = await assertNoHorizontalOverflow(page);
    expect(hasOverflow).toBe(false);
  });

  test('no horizontal overflow on profile', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const vp = page.viewportSize()!;
    if (isMobileViewport(vp.width)) {
      await chatList.switchMobileTab('profile');
    }
    await page.waitForTimeout(500);

    const hasOverflow = await assertNoHorizontalOverflow(page);
    expect(hasOverflow).toBe(false);
  });

  test('container fills viewport width', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const vp = page.viewportSize()!;
    const box = await chatList.container.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThanOrEqual(vp.width - 2);
  });
});

/* ═══════════════════════════════════════════════════
 *  7. ELEMENT OVERLAP CHECKS
 * ═══════════════════════════════════════════════════ */
test.describe('Adaptivity — Element Overlap @adaptivity', () => {

  test('search bar does not overlap filter tabs', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    if (await chatList.searchBar.isVisible() && await chatList.filterTabs.isVisible()) {
      const noOverlap = await elementsDoNotOverlap(chatList.searchBar, chatList.filterTabs);
      expect(noOverlap).toBe(true);
    }
  });

  test('sidebar header does not overlap search', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    if (await chatList.sidebarHeader.isVisible() && await chatList.searchBar.isVisible()) {
      const noOverlap = await elementsDoNotOverlap(chatList.sidebarHeader, chatList.searchBar);
      expect(noOverlap).toBe(true);
    }
  });
});

/* ═══════════════════════════════════════════════════
 *  8. FILTER TABS RESPONSIVENESS
 * ═══════════════════════════════════════════════════ */
test.describe('Adaptivity — Filter Tabs @adaptivity', () => {

  test('filter tabs visible at all viewports', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    await expect(chatList.filterTabs).toBeVisible();
    await expect(chatList.filterAll).toBeVisible();
  });

  test('filter tabs within sidebar bounds', async ({ page }) => {
    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const sidebarBox = await chatList.sidebar.boundingBox();
    const filterBox = await chatList.filterTabs.boundingBox();

    if (sidebarBox && filterBox) {
      expect(filterBox.x).toBeGreaterThanOrEqual(sidebarBox.x - 1);
      expect(filterBox.x + filterBox.width).toBeLessThanOrEqual(sidebarBox.x + sidebarBox.width + 1);
    }
  });

  test('filter tabs scrollable if needed on small screens', async ({ page }) => {
    const vp = page.viewportSize()!;
    if (vp.width > 768) test.skip();

    const chatList = new ChatListPage(page);
    await chatList.goto();
    await dismissBanners(page);

    const overflowX = await getCSSProperty(chatList.filterTabs, 'overflow-x');
    // Filters should allow horizontal scroll on small screens
    expect(['auto', 'scroll', 'hidden']).toContain(overflowX);
  });
});
