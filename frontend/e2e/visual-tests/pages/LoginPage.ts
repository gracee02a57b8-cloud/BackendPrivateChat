/**
 * BarsikChat — Page Object: Login Page
 *
 * Covers: login form, registration toggle, error states,
 * glassmorphism card, feature badges, particle animation
 */
import { type Page, type Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;

  /* ── Layout ── */
  readonly container: Locator;
  readonly card: Locator;
  readonly logo: Locator;
  readonly title: Locator;
  readonly subtitle: Locator;
  readonly features: Locator;
  readonly particles: Locator;

  /* ── Form ── */
  readonly form: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly toggleLink: Locator;
  readonly errorMessage: Locator;

  /* ── Visual ── */
  readonly inputIcons: Locator;
  readonly spinner: Locator;
  readonly confBanner: Locator;

  constructor(page: Page) {
    this.page = page;

    // CSS class selectors (primary)
    this.container = page.locator('.login-container');
    this.card = page.locator('.login-card');
    this.form = page.locator('.login-card form');
    this.submitButton = page.locator('.login-card button[type="submit"]');
    this.errorMessage = page.locator('.login-card .error');
    this.toggleLink = page.locator('.login-toggle');

    // CSS class selectors (secondary)
    this.logo = page.locator('.login-logo');
    this.title = page.locator('.login-card h1');
    this.subtitle = page.locator('.login-subtitle');
    this.features = page.locator('.login-features');
    this.particles = page.locator('.login-particles .particle');
    this.confBanner = page.locator('.login-conf-banner');
    this.inputIcons = page.locator('.login-input-icon');
    this.spinner = page.locator('.spinner');

    // Input selectors (by placeholder — language-specific)
    this.usernameInput = page.getByPlaceholder('Имя пользователя...');
    this.passwordInput = page.getByPlaceholder('Пароль...').first();
    this.confirmPasswordInput = page.getByPlaceholder('Подтвердите пароль...');
  }

  /** Navigate to login page (clears any auth state) */
  async goto() {
    await this.page.context().clearCookies();
    await this.page.goto('/');
    await this.page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.clear();
    }).catch(() => {});
    await this.page.reload();
    await this.page.waitForTimeout(2000);
    await expect(this.container).toBeVisible({ timeout: 15_000 });
  }

  /** Perform login */
  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /** Switch to registration mode */
  async switchToRegister() {
    await this.toggleLink.click();
    await expect(this.confirmPasswordInput).toBeVisible();
  }

  /** Switch back to login mode */
  async switchToLogin() {
    await this.toggleLink.click();
    await expect(this.confirmPasswordInput).not.toBeVisible();
  }

  /** Fill registration form */
  async register(username: string, password: string) {
    await this.switchToRegister();
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(password);
    await this.submitButton.click();
  }

  /** Wait for login to complete (chat container visible) */
  async waitForLoginComplete() {
    await expect(this.page.locator('.chat-container')).toBeVisible({ timeout: 15_000 });
  }

  /** Check if currently in register mode */
  async isRegisterMode(): Promise<boolean> {
    return this.confirmPasswordInput.isVisible();
  }

  /** Get all interactive elements for clickability testing */
  getInteractiveElements(): Locator[] {
    return [
      this.usernameInput,
      this.passwordInput,
      this.submitButton,
      this.toggleLink,
    ];
  }

  /** Dynamic elements to mask in screenshots */
  getDynamicMasks(): Locator[] {
    return [
      this.particles,
      this.confBanner,
    ];
  }
}
