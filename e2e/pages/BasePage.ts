import { Page, Locator } from "@playwright/test";

/**
 * Base Page Object Model class
 * All page objects should extend this class
 */
export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(path = "") {
    await this.page.goto(path);
  }

  async waitForNavigation() {
    await this.page.waitForLoadState("networkidle");
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: `screenshots/${name}.png` });
  }

  getByTestId(testId: string): Locator {
    return this.page.locator(`[data-test-id="${testId}"]`);
  }

  async clickAndWait(selector: string) {
    await this.page.click(selector);
    await this.waitForNavigation();
  }
}
