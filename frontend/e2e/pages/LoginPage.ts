/**
 * BarsikChat — Page Object Model: Login Page
 */
import { type Page, type Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly container: Locator;
  readonly card: Locator;
  readonly logo: Locator;
  readonly title: Locator;
  readonly subtitle: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly toggleLink: Locator;
  readonly errorMessage: Locator;
  readonly features: Locator;
  readonly particles: Locator;
  readonly confBanner: Locator;
  readonly inputIcons: Locator;
  readonly spinner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('.login-container');
    this.card = page.locator('.login-card');
    this.logo = page.locator('.login-logo');
    this.title = page.locator('.login-card h1');
    this.subtitle = page.locator('.login-subtitle');
    this.usernameInput = page.getByPlaceholder('Имя пользователя...');
    this.passwordInput = page.getByPlaceholder('Пароль...').first();
    this.confirmPasswordInput = page.getByPlaceholder('Подтвердите пароль...');
    this.submitButton = page.locator('button[type="submit"]');
    this.toggleLink = page.locator('.login-toggle');
    this.errorMessage = page.locator('.error');
    this.features = page.locator('.login-features');
    this.particles = page.locator('.login-particles .particle');
    this.confBanner = page.locator('.login-conf-banner');
    this.inputIcons = page.locator('.login-input-icon');
    this.spinner = page.locator('.spinner');
  }

  async goto() {
    // Clear auth state to see login page
    await this.page.context().clearCookies();
    await this.page.evaluate(() => localStorage.clear());
    await this.page.goto('/');
    await expect(this.container).toBeVisible();
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async switchToRegister() {
    await this.toggleLink.click();
    await expect(this.confirmPasswordInput).toBeVisible();
  }

  async switchToLogin() {
    await this.toggleLink.click();
    await expect(this.confirmPasswordInput).not.toBeVisible();
  }
}
