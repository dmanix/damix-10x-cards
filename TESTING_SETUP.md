# Testing Environment Setup

This document describes the testing environment setup for the project, including unit tests with Vitest and E2E tests with Playwright.

## Overview

The project uses a comprehensive testing strategy:

- **Unit & Integration Tests**: Vitest with MSW for API mocking
- **E2E Tests**: Playwright with accessibility testing via @axe-core/playwright
- **Test Coverage**: v8 coverage provider
- **Visual Testing**: Playwright screenshots

## Installed Dependencies

### Vitest Stack
- `vitest` - Fast unit test framework with native Vite support
- `@vitest/coverage-v8` - Code coverage using V8
- `@vitest/ui` - Visual UI for test exploration
- `@vitejs/plugin-react` - React plugin for Vite/Vitest
- `jsdom` - DOM environment for component testing
- `happy-dom` - Alternative DOM environment

### Testing Libraries
- `@testing-library/react` - React component testing utilities
- `@testing-library/user-event` - User interaction simulation
- `@testing-library/dom` - DOM testing utilities
- `@testing-library/jest-dom` - Custom matchers for DOM assertions

### API Mocking
- `msw` (Mock Service Worker) - HTTP request mocking for tests

### E2E Testing
- `@playwright/test` - End-to-end testing framework
- `@axe-core/playwright` - Automated accessibility testing

## Project Structure

```
damix-10x-cards/
├── src/
│   └── tests/
│       ├── example.test.ts           # Example unit test
│       ├── setup.ts                  # Global test configuration
│       ├── mocks/
│       │   ├── handlers.ts           # MSW request handlers
│       │   ├── server.ts             # MSW server (Node.js)
│       │   └── browser.ts            # MSW worker (browser)
│       └── README.md                 # Testing documentation
├── e2e/
│   ├── example.spec.ts               # Example E2E test
│   ├── pages/                        # Page Object Model classes
│   │   ├── BasePage.ts               # Base POM class
│   │   └── HomePage.ts               # Home page POM
│   ├── fixtures/
│   │   └── test-data.ts              # Reusable test data
│   └── README.md                     # E2E documentation
├── vitest.config.ts                  # Vitest configuration
├── playwright.config.ts              # Playwright configuration
└── TESTING_SETUP.md                  # This file
```

## Configuration Files

### `vitest.config.ts`

Configures Vitest with:
- jsdom environment for DOM testing
- Global test setup file
- Coverage configuration with v8 provider
- Path aliases (@/ → ./src/)
- UI mode enabled
- Test file patterns

### `playwright.config.ts`

Configures Playwright with:
- Chromium browser only (Desktop Chrome)
- Base URL configuration
- Trace recording on first retry
- Screenshot and video on failure
- HTML, list, and JSON reporters
- Automatic dev server startup

### `src/tests/setup.ts`

Global test setup with:
- Testing Library matchers
- Automatic cleanup after each test
- Mock clearing after tests
- Environment variable stubs
- Global mock for ResizeObserver and IntersectionObserver

## Available Scripts

```bash
# Unit Tests
npm run test              # Run tests in watch mode
npm run test:ui           # Run tests with visual UI
npm run test:run          # Run tests once
npm run test:coverage     # Run tests with coverage report
npm run test:watch        # Explicit watch mode

# E2E Tests
npm run test:e2e          # Run E2E tests
npm run test:e2e:ui       # Run E2E tests with UI mode
npm run test:e2e:debug    # Run E2E tests in debug mode
npm run test:e2e:report   # Show E2E test report

# All Tests
npm run test:all          # Run all tests (unit + E2E)
```

## Writing Tests

### Unit Test Example

Place all unit tests in the `src/tests/` directory:

```typescript
// src/tests/myModule.test.ts
import { describe, it, expect, vi } from 'vitest';
import { myFunction, fetchData } from '@/lib/myModule';

describe('MyFunction', () => {
  it('should return the correct value', () => {
    const result = myFunction(5);
    expect(result).toBe(10);
  });

  it('should handle async operations', async () => {
    const result = await fetchData();
    expect(result).toEqual({ data: 'test' });
  });
});
```

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test';
import { HomePage } from './pages/HomePage';

test('should load home page', async ({ page }) => {
  const homePage = new HomePage(page);
  await homePage.goto();
  
  expect(await homePage.isPageLoaded()).toBe(true);
});
```

### API Mocking with MSW

```typescript
// src/tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/endpoint', () => {
    return HttpResponse.json({ data: 'mocked' });
  }),
];
```

## Best Practices

### Unit Tests
1. ✅ Place all tests in `src/tests/` directory (`.test.ts` or `.spec.ts` files)
2. ✅ Use descriptive test names
3. ✅ Follow Arrange-Act-Assert pattern
4. ✅ Mock external dependencies with MSW
5. ✅ Test edge cases and error scenarios
6. ✅ Keep tests isolated and independent

### E2E Tests
1. ✅ Use Page Object Model pattern
2. ✅ Use stable selectors (data-testid, ARIA roles)
3. ✅ Leverage Playwright's auto-waiting
4. ✅ Test critical user journeys
5. ✅ Include accessibility tests
6. ✅ Use fixtures for test data

## Running Tests

### Local Development

```bash
# Watch mode for unit tests during development
npm run test

# Run specific test file
npm run test -- src/tests/myModule.test.ts

# Run tests matching a pattern
npm run test -- -t "should handle errors"

# Run E2E tests with UI for debugging
npm run test:e2e:ui
```

### CI/CD Pipeline

```bash
# Build the application
npm run build

# Run all tests
npm run test:all
```

## Debugging

### Vitest
- Use `npm run test:ui` for visual debugging
- Use `--watch` mode for quick feedback
- Check console output and error messages
- Use debugger statements in tests

### Playwright
- Use `npm run test:e2e:ui` for time-travel debugging
- Use `npm run test:e2e:debug` for step-by-step execution
- View traces with `npm run test:e2e:report`
- Check screenshots in `test-results/` directory

## Coverage Reports

Run coverage analysis:

```bash
npm run test:coverage
```

Coverage reports are generated in:
- `coverage/` directory (HTML, JSON, LCOV formats)
- Console output with summary

## Continuous Integration

Tests are automatically run in CI/CD pipelines on:
- Pull requests
- Push to main branch
- Manual workflow dispatch

Ensure all tests pass before merging pull requests.

## Troubleshooting

### Common Issues

1. **Playwright browser not found**
   ```bash
   npx playwright install chromium
   ```

2. **Port already in use**
   - Check if dev server is already running
   - Change port in `playwright.config.ts`

3. **Tests timing out**
   - Increase timeout in test configuration
   - Check for network issues

4. **Coverage not generated**
   - Ensure `@vitest/coverage-v8` is installed
   - Check `vitest.config.ts` coverage settings

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [MSW Documentation](https://mswjs.io/)
- [Testing Library Documentation](https://testing-library.com/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Next Steps

1. Write unit tests for existing components and functions
2. Create E2E tests for critical user journeys
3. Set up CI/CD pipeline for automated testing
4. Configure coverage thresholds
5. Add visual regression testing if needed

## Support

For questions or issues with the testing setup, please:
1. Check the documentation in `src/tests/README.md` and `e2e/README.md`
2. Review example tests
3. Consult the official documentation linked above
