import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "@axe-core/playwright";

/**
 * Example E2E test file
 * This demonstrates Playwright usage with Page Object Model and accessibility testing
 */

test.describe("Example E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage before each test
    await page.goto("/");
  });

  test("should load the homepage", async ({ page }) => {
    // Check if the page has loaded
    await expect(page).toHaveURL("/");

    // Verify page title or heading exists
    await expect(page.locator("body")).toBeVisible();
  });

  test("should have proper accessibility", async ({ page }) => {
    // Inject axe-core for accessibility testing
    await injectAxe(page);

    // Run accessibility checks
    await checkA11y(page, undefined, {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    });
  });

  test.skip("should navigate between pages", async ({ page }) => {
    // Example of navigation testing
    // Uncomment when you have navigation elements
    await page.click('a[href="/flashcards"]');
    await expect(page).toHaveURL("/flashcards");
  });

  test.skip("should interact with forms", async ({ page }) => {
    // Example of form interaction
    // Uncomment when you have forms
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');
    await expect(page.locator(".success-message")).toBeVisible();
  });
});
