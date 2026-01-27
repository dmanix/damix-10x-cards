# Testing Documentation

This directory contains unit and integration test files for the application.

## Structure

```
src/tests/
├── setup.ts              # Global test setup and configuration
├── example.test.ts       # Example unit test
├── mocks/
│   ├── handlers.ts       # MSW request handlers for API mocking
│   ├── server.ts         # MSW server for Node.js (Vitest)
│   └── browser.ts        # MSW worker for browser (manual testing)
└── README.md            # This file
```

## Running Tests

### Unit Tests (Vitest)

```bash
# Run tests in watch mode
npm run test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test -- src/tests/example.test.ts

# Run tests matching a pattern
npm run test -- -t "should handle async"
```

### E2E Tests (Playwright)

```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests with UI mode
npm run test:e2e:ui

# Run E2E tests in debug mode
npm run test:e2e:debug

# View test report
npm run test:e2e:report

# Run specific test file
npm run test:e2e -- example.spec.ts
```

### Run All Tests

```bash
npm run test:all
```

## Writing Tests

### Unit Tests

Unit tests should be placed in the `src/tests/` directory with a `.test.ts` or `.spec.ts` extension.

Example:

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('MyComponent', () => {
  it('should render correctly', () => {
    expect(true).toBe(true);
  });
});
```

### Mocking with MSW

To mock API calls, add handlers to `src/tests/mocks/handlers.ts`:

```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/endpoint', () => {
    return HttpResponse.json({ data: 'mocked' });
  }),
];
```

### E2E Tests

E2E tests should be placed in the `e2e/` directory with a `.spec.ts` extension.

Use the Page Object Model pattern for better maintainability:

```typescript
import { test, expect } from '@playwright/test';
import { HomePage } from './pages/HomePage';

test('should navigate to home page', async ({ page }) => {
  const homePage = new HomePage(page);
  await homePage.goto();
  
  expect(await homePage.isPageLoaded()).toBe(true);
});
```

## Best Practices

### Unit Tests (Vitest)

1. Use descriptive test names
2. Follow the Arrange-Act-Assert pattern
3. Mock external dependencies
4. Test edge cases and error scenarios
5. Keep tests isolated and independent
6. Use `vi.fn()` for function mocks
7. Use `vi.spyOn()` to monitor existing functions
8. Configure coverage thresholds for critical paths

### E2E Tests (Playwright)

1. Use Page Object Model for maintainability
2. Use data-testid attributes for stable selectors
3. Leverage auto-waiting (avoid manual waits)
4. Test critical user journeys
5. Include accessibility tests with @axe-core/playwright
6. Use fixtures for reusable test data
7. Take screenshots on failure
8. Use trace viewer for debugging

## Debugging

### Vitest

- Use `--ui` flag for visual debugging
- Use `console.log()` or debugger statements
- Run tests in watch mode for quick feedback

### Playwright

- Use `--debug` flag to step through tests
- Use `--ui` flag for visual debugging
- Check trace files in `playwright-report/`
- View screenshots in `test-results/`

## CI/CD Integration

Tests are automatically run in CI/CD pipelines. Ensure all tests pass before merging.

### GitHub Actions

Tests will run on:
- Pull requests
- Push to main branch
- Manual workflow dispatch

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [MSW Documentation](https://mswjs.io/)
- [Testing Library Documentation](https://testing-library.com/)
