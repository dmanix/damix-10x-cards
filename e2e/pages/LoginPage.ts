import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * Page Object Model for the Login page
 */
export class LoginPage extends BasePage {
  readonly loginForm: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);

    this.loginForm = this.getByTestId("login-form");
    this.emailInput = this.getByTestId("login-email");
    this.passwordInput = this.getByTestId("login-password");
    this.submitButton = this.getByTestId("login-submit");
  }

  async goto(returnTo?: string) {
    const search = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
    await super.goto(`/auth/login${search}`);

    // Wait for the page to fully load
    await this.page.waitForLoadState("networkidle");

    // Wait for React hydration - the form element should have the data-test-id attribute
    // We use a more robust approach: wait for the specific attribute to appear
    await this.page.waitForSelector('[data-test-id="login-form"]', {
      state: "visible",
      timeout: 15000,
    });
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
