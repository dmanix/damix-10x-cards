# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Damix 10x Cards is an AI-powered flashcard generator and spaced repetition companion that reduces the time required to create effective study flashcards. Users paste text, generate candidate flashcards using AI, verify/edit them, and study using spaced repetition.

**Tech Stack:** Astro 5, TypeScript 5, React 19, Tailwind CSS 4, Shadcn/ui, Supabase (PostgreSQL + Auth), OpenRouter.ai (LLM access)

## Common Commands

### Development
```bash
npm run dev              # Start dev server (port 3000)
npm run dev:e2e          # Start dev server in test mode
npm run build            # Build for production
npm run preview          # Preview production build
```

### Code Quality
```bash
npm run lint             # Check with ESLint
npm run lint:fix         # Auto-fix ESLint issues
npm run format           # Format with Prettier
```

### Testing
```bash
npm run test             # Run unit tests (Vitest watch mode)
npm run test:run         # Run unit tests once
npm run test:ui          # Run tests with Vitest UI
npm run test:coverage    # Generate coverage report
npm run test:watch       # Watch mode for unit tests

npm run test:e2e         # Run E2E tests (Playwright)
npm run test:e2e:ui      # Run E2E with Playwright UI
npm run test:e2e:debug   # Debug E2E tests
npm run test:e2e:report  # Show test report

npm run test:all         # Run both unit and E2E tests
```

## Architecture & Structure

### Directory Structure
```
src/
├── pages/              # Astro pages (routes)
│   └── api/            # API endpoints (POST, GET handlers)
├── layouts/            # Page layouts (Layout.astro, AuthLayout.astro)
├── components/         # UI components
│   ├── ui/             # Shadcn/ui base components
│   ├── auth/           # Auth forms (Login, Register, etc.)
│   ├── flashcards/     # Flashcard management UI
│   ├── generate/       # AI generation workflow UI
│   ├── dashboard/      # Dashboard widgets
│   └── hooks/          # Custom React hooks
├── lib/                # Services and utilities
│   ├── services/       # Business logic (flashcardService, generationService)
│   ├── openrouter/     # OpenRouter API client
│   ├── validation/     # Zod schemas
│   └── auth/           # Auth utilities
├── db/                 # Supabase client setup and types
│   ├── supabase.client.ts     # Client factory
│   └── database.types.ts      # Auto-generated DB types
├── middleware/         # Astro middleware (auth checks)
├── types.ts            # Shared TypeScript types (DTOs, entities)
├── tests/              # Unit and integration tests
│   ├── setup.ts        # Test configuration
│   └── mocks/          # MSW handlers for API mocking
└── assets/             # Internal static assets

e2e/                    # End-to-end tests
├── pages/              # Page Object Models
└── fixtures/           # Test data
```

### Architectural Patterns

#### Request Flow
1. **Astro Middleware** (`src/middleware/index.ts`): Authenticates user via Supabase, stores `user` and `supabase` in `context.locals`
2. **Pages/API Endpoints**: Access `context.locals.supabase` (NEVER import `supabaseClient` directly in routes)
3. **Services**: Business logic lives in `src/lib/services/` (e.g., `flashcardService`, `generationService`)
4. **Frontend Components**: React components call API endpoints; Astro components render static/SSR content

#### Supabase Usage
- **ALWAYS** use `context.locals.supabase` in Astro routes/API endpoints (set by middleware)
- Use the `SupabaseClient` type from `src/db/supabase.client.ts` (NOT from `@supabase/supabase-js`)
- Direct client import (`supabaseClient`) is only for standalone utilities/tests
- Cookie-based auth via `@supabase/ssr` with server-side client creation

#### API Endpoints
- Use uppercase HTTP method handlers: `export async function POST(context: APIContext)` (not `export const POST = ...`)
- Always set `export const prerender = false` for API routes
- Validate input with Zod schemas from `src/lib/validation/`
- Return consistent error responses using `ErrorResponse` type from `src/types.ts`
- Extract business logic to services in `src/lib/services/`

#### Type Safety
- Shared types (DTOs, entities) live in `src/types.ts`
- Database types auto-generated in `src/db/database.types.ts`
- Component-specific types can live in `[component]/types.ts` (e.g., `src/components/generate/types.ts`)

#### Frontend Component Strategy
- **Astro Components (`.astro`)**: For static content, layouts, and pages
- **React Components (`.tsx`)**: Only when interactivity is needed (client:load, client:idle directives)
- Never use "use client" or other Next.js directives (this is Astro + React, not Next.js)

#### Error Handling Pattern
```typescript
// Guard clauses first
if (!user) {
  return jsonError(401, "unauthorized", "User not authenticated");
}

if (invalidInput) {
  return jsonError(400, "invalid_input", "Details here");
}

// Happy path last
const result = await service.doWork();
return jsonSuccess(result);
```

## Key Conventions

### Code Style
- **Early returns** for error conditions (avoid nested if/else)
- **Guard clauses** at function start
- **Error-first**: Handle edge cases before happy path
- Use Zod for all input validation
- Prefer custom error classes (`GenerationOwnershipError`, `FlashcardNotFoundError`)

### Testing
- **Unit/Integration tests**: Place ALL test files in `src/tests/` directory
  - Naming: `[feature-name].test.ts` or `[feature-name].spec.ts`
  - NEVER place `.test.ts` files next to source code
- **E2E tests**: Place in `e2e/` directory (Playwright)
- Use MSW for API mocking (handlers in `src/tests/mocks/`)
- Setup file: `src/tests/setup.ts`

### Environment Variables
- Supabase: `SUPABASE_URL`, `SUPABASE_KEY`
- OpenRouter: `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`
- Access via `import.meta.env.VAR_NAME` in Astro/Vite context

### Styling
- Use Tailwind CSS 4 utility classes
- Use `@layer` directive for custom styles
- Dark mode: `dark:` variant
- Responsive: `sm:`, `md:`, `lg:`, `xl:` variants
- Leverage `class-variance-authority`, `clsx`, and `tailwind-merge` for variant-driven styles

### Accessibility
- Use ARIA landmarks (`main`, `navigation`, `search`)
- Apply `aria-label`, `aria-labelledby`, `aria-describedby` where needed
- Use `aria-expanded`, `aria-controls` for expandables
- Avoid redundant ARIA that duplicates semantic HTML

## Service Layer Details

### FlashcardService (`src/lib/services/flashcardService.ts`)
- CRUD operations for flashcards
- Handles ownership checks and generation associations
- Methods: `list()`, `getById()`, `create()`, `update()`, `delete()`
- Custom errors: `FlashcardNotFoundError`, `GenerationOwnershipError`

### GenerationService (`src/lib/services/generationService.ts`)
- Manages AI flashcard generation flow
- Tracks daily limits and quotas
- Logs user actions (accept, edit, reject)
- Methods: `createGeneration()`, `getQuota()`, `list()`

### OpenRouterService (`src/lib/openrouter/openRouterService.ts`)
- Abstraction for OpenRouter API
- Supports chat completions and structured JSON output (with JSON Schema)
- Custom errors: `OpenRouterConfigError`, `OpenRouterTimeoutError`, `OpenRouterUpstreamError`
- Configurable via `OpenRouterConfig` type

## Important Notes

- **Astro output mode**: `server` (SSR enabled) with Node adapter in standalone mode
- **Dev server port**: 3000 (configurable in `astro.config.mjs`)
- **Git hooks**: Husky + lint-staged auto-format/lint staged files on commit
- **Protected routes**: Middleware guards `/dashboard`, `/generate`, `/flashcards`, `/api/flashcards`, `/api/generations`
- **Public API routes**: `/api/auth/*` are public (login, register, logout, password reset)
- **Guest-only paths**: `/auth/login` redirects authenticated users to dashboard

## Development Workflow

1. Ensure Node 22.14.0 (use `nvm use`)
2. Install dependencies: `npm install`
3. Configure `.env` with Supabase and OpenRouter credentials
4. Start dev server: `npm run dev`
5. Run tests during development: `npm run test` (watch mode)
6. Lint/format before commit: `npm run lint:fix && npm run format` (or rely on Husky hooks)
7. For production build: `npm run build && npm run preview`

## Additional Resources

- README.md for project scope, MVP features, and out-of-scope items
- `.cursor/rules/` contains detailed AI coding guidelines for Astro, React, testing, backend, Supabase, etc.
- `.github/copilot-instructions.md` has project structure and coding practices
