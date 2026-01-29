## Damix 10x Cards

AI‑powered flashcard generator and spaced repetition companion for students and self‑learners.

[![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)](./package.json)
[![Node](https://img.shields.io/badge/node-22.14.0-43853d?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Astro](https://img.shields.io/badge/astro-5.x-ff5d01?logo=astro&logoColor=white)](https://astro.build/)
[![React](https://img.shields.io/badge/react-19.x-61dafb?logo=react&logoColor=black)](https://react.dev/)

---

## Table of Contents

- [Project name](#project-name)
- [Project description](#project-description)
- [Tech stack](#tech-stack)
- [Getting started locally](#getting-started-locally)
- [Available scripts](#available-scripts)
- [Project scope](#project-scope)
- [Project status](#project-status)
- [License](#license)

---

## Project name

**Damix 10x Cards**

An AI‑assisted flashcard creation tool designed to make high‑quality spaced‑repetition decks faster to create.

---

## Project description

Damix 10x Cards is a web application that radically reduces the time required to create effective study flashcards. Instead of manually extracting key facts and turning them into question‑and‑answer pairs, users can paste a block of text and let the app generate a set of candidate flashcards using AI.

The app is aimed at students, pupils, and self‑taught learners who want to benefit from spaced repetition systems but are discouraged by the tedious process of building decks by hand. By combining AI‑powered generation with a verification workflow and an existing open‑source spaced‑repetition algorithm, Damix 10x Cards lowers the barrier to using proven long‑term memorization techniques.

**Key capabilities (as defined in the product requirements):**

- **AI generation from text**: Paste a text snippet (approximately 1,000–20,000 characters) and generate a batch of suggested flashcards in a synchronous flow with clear loading feedback.
- **Quality‑controlled prompts**: Flashcards are generated using a central, configurable system prompt that enforces quality rules (e.g., no yes/no questions, character limits).
- **Input validation**: The app validates input length and can surface a dedicated message when the provided text is too short, too long, or too low quality for meaningful flashcards.
- **User accounts**: Email‑and‑password based accounts back up each user’s personal collection of cards, with secure password storage and standard login/logout flows.
- **Verification workflow**: Users review generated cards and can accept, reject, or edit each card before saving it to their personal collection.
- **Collection management**: In addition to generated cards, users can create, browse, edit, and delete their own cards manually.
- **Learning sessions**: Cards are scheduled using an integrated, open‑source spaced repetition algorithm; the UI supports showing the “front” first, then revealing the “back” and rating recall.
- **Analytics & logging**: User actions around generated cards (accepted, edited and accepted, rejected) are logged to support metrics such as AI card acceptance rate and AI utilization.

---

## Tech stack

**Core technologies**

- **Framework**: Astro 5 (with Node adapter) for fast, content‑focused web applications.
- **UI layer**: React 19 for interactive components where needed.
- **Language**: TypeScript 5 for static typing and better IDE support.
- **Styling**: Tailwind CSS 4, with utilities such as `class-variance-authority`, `clsx`, and `tailwind-merge` to manage composable, variant‑driven styles.
- **Component library**: Shadcn/ui React components as the base for accessible, modern UI elements.

**Backend & data**

- **Supabase**:
  - PostgreSQL database for persisting users, flashcards, interactions, and metrics.
  - Built‑in authentication (email/password) for user accounts.
  - SDKs used as a Backend‑as‑a‑Service layer for data access and auth.

**AI integration**

- **OpenRouter.ai**:
  - Provides access to multiple LLM providers (OpenAI, Anthropic, Google, and others).
  - Centralized system prompt defines flashcard generation rules and quality checks.
  - API keys can be configured with financial limits to control usage costs.

**Tooling & quality**

- **Linting**: ESLint 9 with TypeScript, React, Astro, accessibility (`jsx-a11y`), import rules, and Prettier integration.
- **Formatting**: Prettier with `prettier-plugin-astro`.
- **Git hooks**: Husky + lint‑staged to automatically lint/format staged files before commits.
- **Package manager**: npm (see `package-lock.json`).

**Testing**

- **Unit & Integration testing**:
  - **Vitest** with `@vitest/coverage-v8` and `@vitest/ui` for fast, native Vite/Astro testing.
  - **MSW 2.x** (Mock Service Worker) for modern HTTP mocking (OpenRouter, Supabase) using fetch-based API.
  - **Zod** schemas for input/output validation testing.

- **E2E testing**:
  - **Playwright** for browser-based UI and API testing with auto-waiting and multi-browser support (Chromium/Firefox/WebKit).
  - **@axe-core/playwright** for automated accessibility (a11y) testing integrated into E2E flows.

- **API testing & manual verification**:
  - **Bruno** for git-friendly, offline-first API collections (alternative to Postman).

**CI/CD & hosting**

- **CI/CD**: GitHub Actions for continuous integration and delivery pipelines (workflows can run tests, linters, and builds on each push/PR).
- **Hosting**: DigitalOcean, typically via a Docker image built from the Astro Node adapter.

---

## Getting started locally

### Prerequisites

- **Node.js**: `22.14.0` (recommended via `.nvmrc`).
  - If you use `nvm`, run:

    ```bash
    nvm use
    ```

- **npm**: Comes bundled with Node.js.
- **Supabase project**: You will need a Supabase project (URL and anon key) for authentication and data storage.
- **OpenRouter API key**: Required for calling AI models through OpenRouter.ai.


### 1. Clone the repository

```bash
git clone https://github.com/dmanix/damix-10x-cards.git
cd damix-10x-cards
```

### 2. Configure Node version

Use the Node version from `.nvmrc`:

```bash
nvm use
```

If you do not use `nvm`, install Node.js `22.14.0` from your preferred source.

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the project root (or use your preferred environment management solution) and add the necessary configuration. For example:

```bash
# Supabase
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key

# OpenRouter
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

Adjust variable names and values to match your implementation of the Supabase client and OpenRouter integration.

### 5. Start the development server

```bash
npm run dev
```

By default, Astro uses port `3000`, so you can usually open:

```text
http://localhost:3000
```

Check your terminal output in case a different port is used.

### 6. Optional: Run linters and formatters

To check code quality:

```bash
npm run lint
```

To automatically fix lint issues where possible:

```bash
npm run lint:fix
```

To format the codebase with Prettier:

```bash
npm run format
```

### 7. Build and preview for production

Build the project:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

These commands use Astro’s build and preview pipeline, with the Node adapter for deployment in Node.js environments or Docker images.

---

## Available scripts

All scripts are defined in `package.json`.

- **Development**
  - **`npm run dev`**: Starts the Astro development server with hot module reloading.
  - **`npm run astro`**: Runs the Astro CLI directly for advanced tasks.

- **Build & preview**
  - **`npm run build`**: Builds the project for production using Astro.
  - **`npm run preview`**: Serves the production build locally for final checks.

- **Quality & formatting**
  - **`npm run lint`**: Runs ESLint across the project using the configured rules (TypeScript, React, Astro, accessibility, imports, Prettier, etc.).
  - **`npm run lint:fix`**: Runs ESLint with `--fix` to automatically correct fixable issues.
  - **`npm run format`**: Runs Prettier to format supported files (including Astro, TypeScript, JSON, CSS, and Markdown via `lint-staged` and Prettier).

> Additionally, Husky and lint‑staged are configured so that on each commit, staged source files are automatically linted and formatted.

---

## Project scope

The product requirements document defines a clear MVP scope and explicitly calls out what is out of scope for the initial release.

### In scope (MVP)

- **User accounts**
  - Email‑and‑password registration with validation (format checks, minimum password length).
  - Handling of duplicate email registrations with clear feedback.
  - Login/logout flows, with redirect behavior on successful authentication or after logout.

- **AI flashcard generation**
  - Text input area accepting approximately 1,000–20,000 characters.
  - “Generate flashcards” action that runs synchronously, with visible loading/processing state.
  - Central, configurable system prompt governing output quality (e.g., no yes/no cards, character limits).
  - Validation for input length with explanatory messages and disabled generate button if invalid.
  - Detection of low‑quality material, with a dedicated AI message when meaningful cards cannot be produced.
  - Per‑user, configurable daily limit on generation operations stored in the database.

- **Verification & saving**
  - Post‑generation verification view showing all proposed cards in read‑only mode initially.
  - Per‑card actions: **Accept**, **Reject**, **Edit**.
  - Edit mode exposing “front” (question, ≤ 200 chars) and “back” (answer, ≤ 500 chars) for correction.
  - “Save and accept” behavior for edited cards, adding them to the user’s collection.
  - Logging of each action (accepted without changes, accepted after edit, rejected) for analytics.

- **Collection management**
  - Manual card creation with fields for front and back.
  - “My collection” view listing all accepted and manually created cards.
  - Editing existing cards in the collection.
  - Deleting cards with confirmation and permanent removal from the database.
  - Metadata on each card indicating origin (`AI` vs `manual`) and whether it has been edited since creation.

- **Learning (spaced repetition)**
  - Integration with an existing open‑source spaced repetition algorithm to select which card to show next.
  - “Start learning” entry point that begins a learning session.
  - Learning UI that:
    - Shows the card “front” first.
    - Allows the user to reveal the “back” (answer).
    - Provides rating options for self‑assessment, wired into the chosen SRS algorithm.

- **Metrics & logging**
  - Logging of user interactions with generated cards to support:
    - **AI Flashcard Acceptance Rate (MS‑01)**: percentage of generated cards that are accepted (with or without edits), target ≥ 75%.
    - **AI Utilization Rate (MS‑02)**: share of AI‑generated cards among all cards in users’ collections, target ≥ 75%.

### Out of scope (for the MVP)

- Building a proprietary or advanced custom spaced repetition algorithm (the app intentionally integrates an existing open‑source solution instead).
- Importing content from multiple file formats (PDF, DOCX, etc.).
- Sharing flashcard sets between users (no collaborative/public decks in the MVP).
- Integrations with third‑party educational platforms.
- Native mobile applications (initially web‑only experience).

---

## Project status

- **Version**: `0.0.3`.
- **Stage**: Early development / MVP implementation in progress.
- The repository already includes a detailed product requirements document and a defined tech stack, but not all features described there may be implemented yet.
- Expect the domain model, Supabase schema, AI prompt design, and SRS integration details to evolve as the MVP is built and validated against the defined success metrics (AI card acceptance rate and AI utilization rate).


---

## License

A license has not yet been specified for this project.

Until a formal license is added (e.g., via a `LICENSE` file and/or the `license` field in `package.json`), please treat the code as **all rights reserved** and contact the repository owner before using it in production or redistributing it.


