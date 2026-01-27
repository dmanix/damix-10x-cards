# E2E Testing Documentation

This directory contains end-to-end tests using Playwright.

## Structure

```
e2e/
├── example.spec.ts      # Example E2E test
├── pages/               # Page Object Model classes
│   ├── BasePage.ts      # Base class for all pages
│   └── HomePage.ts      # Home page object
├── fixtures/            # Test data and fixtures
│   └── test-data.ts     # Reusable test data
└── README.md           # This file
```

## Page Object Model

The Page Object Model (POM) pattern helps maintain E2E tests by encapsulating page interactions into reusable classes.

### Creating a New Page Object

1. Create a new file in `e2e/pages/` (e.g., `LoginPage.ts`)
2. Extend the `BasePage` class
3. Define locators as readonly properties
4. Create methods for page interactions

Example:

```typescript
import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.locator('input[name="email"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.submitButton = page.locator('button[type="submit"]');
  }

  async goto() {
    await super.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
```

## Test Fixtures

Reusable test data should be stored in the `fixtures/` directory.

Example usage:

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { testUsers } from './fixtures/test-data';

test('should login with valid credentials', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(testUsers.validUser.email, testUsers.validUser.password);
  
  await expect(page).toHaveURL('/dashboard');
});
```

## Accessibility Testing

All pages should include accessibility tests using @axe-core/playwright:

```typescript
import { test } from '@playwright/test';
import { injectAxe, checkA11y } from '@axe-core/playwright';

test('should have no accessibility violations', async ({ page }) => {
  await page.goto('/');
  await injectAxe(page);
  await checkA11y(page);
});
```

## Best Practices

1. **Use Page Object Model** - Encapsulate page interactions
2. **Stable Selectors** - Use data-testid or ARIA roles
3. **Auto-waiting** - Playwright waits automatically, avoid manual waits
4. **Test User Journeys** - Focus on critical paths
5. **Parallel Execution** - Tests run in parallel by default
6. **Screenshots & Videos** - Captured on failure automatically
7. **Trace Files** - Enable for debugging failed tests

## Running Tests

See the main testing documentation in `src/tests/README.md` for commands.

## Debugging

### UI Mode
```bash
npm run test:e2e:ui
```
Interactive mode with time-travel debugging.

### Debug Mode
```bash
npm run test:e2e:debug
```
Step through tests with Playwright Inspector.

### Trace Viewer
```bash
npm run test:e2e:report
```
View detailed trace files with screenshots, network requests, and console logs.

## CI/CD

E2E tests run automatically in CI/CD pipelines. They require a built application:

```bash
npm run build
npm run test:e2e
```

## Resources

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Page Object Model](https://playwright.dev/docs/pom)
- [Test Fixtures](https://playwright.dev/docs/test-fixtures)
- [Accessibility Testing](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright)
