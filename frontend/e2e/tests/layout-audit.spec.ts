/**
 * Layout Audit — captures screenshots of every screen at multiple viewports
 * and checks for common layout bugs (overflow, missing elements, z-index).
 */
import { test, expect, Page } from '@playwright/test';

const BASE = 'https://barsikchat.duckdns.org';
const USER = 'playwright_tester';
const PASS = 'TestPass2026!';

const VIEWPORTS = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-360', width: 360, height: 640 },
];

async function login(page: Page) {
  await page.goto(BASE);
  await page.waitForTimeout(1000);

  // If already logged in, return
  const url = page.url();
  if (!url.includes('login') && await page.locator('.chat-container').count() > 0) {
    return;
  }

  // Fill login form
  const usernameInput = page.locator('input[placeholder*="Имя"], input[name="username"], input[type="text"]').first();
  const passwordInput = page.locator('input[type="password"]').first();
  const loginBtn = page.locator('button[type="submit"], .login-btn').first();

  await usernameInput.fill(USER);
  await passwordInput.fill(PASS);
  await loginBtn.click();

  await page.waitForTimeout(3000);
}

async function dismissBanners(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll('.media-perm-banner, .connection-banner, .pwa-install-prompt').forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
  });
}

test.describe('Layout Audit', () => {
  for (const vp of VIEWPORTS) {
    test.describe(`${vp.name} (${vp.width}×${vp.height})`, () => {

      test('Login page', async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await ctx.newPage();
        await page.goto(BASE);
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `e2e/audit-screenshots/${vp.name}-login.png`, fullPage: true });

        // Check: no horizontal overflow
        const overflows = await page.evaluate(() => {
          const docWidth = document.documentElement.scrollWidth;
          const viewWidth = document.documentElement.clientWidth;
          return { docWidth, viewWidth, overflow: docWidth > viewWidth };
        });
        console.log(`[${vp.name}] Login overflow: ${JSON.stringify(overflows)}`);

        await ctx.close();
      });

      test('Chat main view', async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await ctx.newPage();
        await login(page);
        await dismissBanners(page);
        await page.waitForTimeout(1000);

        await page.screenshot({ path: `e2e/audit-screenshots/${vp.name}-chat-main.png`, fullPage: false });

        // Check sidebar
        const sidebar = page.locator('.chat-sidebar');
        const sidebarBox = await sidebar.boundingBox();
        console.log(`[${vp.name}] Sidebar box: ${JSON.stringify(sidebarBox)}`);

        if (sidebarBox) {
          // Sidebar should not have negative x or overflow
          if (sidebarBox.x < -1) {
            console.error(`[${vp.name}] BUG: Sidebar x=${sidebarBox.x} — shifted off screen!`);
          }
          if (sidebarBox.x + sidebarBox.width > vp.width + 1) {
            console.error(`[${vp.name}] BUG: Sidebar overflows right edge!`);
          }
        }

        // Check chat-main (right panel)
        const chatMain = page.locator('.chat-main');
        const chatMainBox = await chatMain.boundingBox();
        console.log(`[${vp.name}] ChatMain box: ${JSON.stringify(chatMainBox)}`);

        // Check bottom nav on mobile
        if (vp.width <= 768) {
          const bottomNav = page.locator('.mobile-bottom-nav');
          const bnCount = await bottomNav.count();
          console.log(`[${vp.name}] Bottom nav present: ${bnCount > 0}`);
          if (bnCount > 0) {
            const bnBox = await bottomNav.boundingBox();
            console.log(`[${vp.name}] Bottom nav box: ${JSON.stringify(bnBox)}`);
          }
        }

        // Check for horizontal overflow
        const overflows = await page.evaluate(() => {
          const docWidth = document.documentElement.scrollWidth;
          const viewWidth = document.documentElement.clientWidth;
          return { docWidth, viewWidth, overflow: docWidth > viewWidth };
        });
        console.log(`[${vp.name}] Chat overflow: ${JSON.stringify(overflows)}`);

        // Check container
        const container = page.locator('.chat-container');
        const containerBox = await container.boundingBox();
        console.log(`[${vp.name}] Container box: ${JSON.stringify(containerBox)}`);

        await ctx.close();
      });

      test('Chat room open', async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await ctx.newPage();
        await login(page);
        await dismissBanners(page);
        await page.waitForTimeout(1000);

        // Try to open first room
        const rooms = page.locator('.sb-chat-item');
        const roomCount = await rooms.count();
        if (roomCount === 0) {
          console.log(`[${vp.name}] No rooms — skipping room view`);
          await ctx.close();
          return;
        }

        await rooms.first().click();
        await page.waitForTimeout(1500);
        await dismissBanners(page);

        await page.screenshot({ path: `e2e/audit-screenshots/${vp.name}-chat-room.png`, fullPage: false });

        // Check back button on mobile
        if (vp.width <= 768) {
          const backBtn = page.locator('.chat-header-back, .back-btn, [class*="back"]');
          const backCount = await backBtn.count();
          console.log(`[${vp.name}] Back button present: ${backCount > 0}`);
          if (backCount === 0) {
            console.error(`[${vp.name}] BUG: No back button in chat room on mobile!`);
          }
        }

        // Check message form
        const msgForm = page.locator('.message-form');
        const formBox = await msgForm.boundingBox();
        console.log(`[${vp.name}] Message form box: ${JSON.stringify(formBox)}`);

        // Check header
        const header = page.locator('.chat-header');
        const headerBox = await header.boundingBox();
        console.log(`[${vp.name}] Chat header box: ${JSON.stringify(headerBox)}`);

        await ctx.close();
      });

      test('Profile page', async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await ctx.newPage();
        await login(page);
        await dismissBanners(page);
        await page.waitForTimeout(1000);

        // Navigate to profile
        if (vp.width <= 768) {
          // Mobile: use bottom nav
          const profileTab = page.locator('.bottom-nav-item').last();
          if (await profileTab.count() > 0) {
            await profileTab.click();
            await page.waitForTimeout(1000);
          }
        } else {
          // Desktop: use burger menu
          const burger = page.locator('.sb-burger-btn');
          if (await burger.count() > 0) {
            await burger.evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
            await page.waitForTimeout(500);
            // Look for profile option
            const profileOption = page.locator('.burger-drawer .drawer-item, .burger-drawer button, .drawer-item').filter({ hasText: /профиль|profile/i }).first();
            if (await profileOption.count() > 0) {
              await profileOption.click();
              await page.waitForTimeout(1000);
            }
          }
        }

        await dismissBanners(page);
        await page.screenshot({ path: `e2e/audit-screenshots/${vp.name}-profile.png`, fullPage: false });

        // Check for back button
        const backBtn = page.locator('.chat-header-back, .back-btn, .profile-back, [class*="back"]');
        const backCount = await backBtn.count();
        console.log(`[${vp.name}] Profile back button present: ${backCount > 0}`);

        await ctx.close();
      });

    });
  }
});
