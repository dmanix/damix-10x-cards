import { Page, Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * Page Object Model for the Home Page
 * Encapsulates all interactions with the home page
 */
export class HomePage extends BasePage {
  // Define locators for page elements
  readonly heading: Locator;
  readonly loginButton: Locator;
  readonly signupButton: Locator;

  constructor(page: Page) {
    super(page);

    // Initialize locators
    this.heading = page.locator("h1").first();
    this.loginButton = page.locator('a[href*="login"]').first();
    this.signupButton = page.locator('a[href*="signup"]').first();
  }

  async goto() {
    await super.goto("/");
  }

  async getHeadingText(): Promise<string> {
    return (await this.heading.textContent()) || "";
  }

  async clickLogin() {
    await this.loginButton.click();
  }

  async clickSignup() {
    await this.signupButton.click();
  }

  async isPageLoaded(): Promise<boolean> {
    return await this.heading.isVisible();
  }
}
