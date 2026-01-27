### 1. Wprowadzenie i cele testowania

Celem testów jest zapewnienie jakości MVP aplikacji **Damix 10x Cards**: logowanie/rejestracja/reset hasła, generowanie fiszek z użyciem AI (OpenRouter) oraz zarządzanie kolekcją fiszek (CRUD) z zachowaniem bezpieczeństwa sesji i izolacji danych użytkowników. Projekt działa w architekturze **Astro 5 SSR + React 19 + Supabase + TypeScript**.

**Cele szczegółowe**:
- **Stabilność kluczowych ścieżek**: `/auth/*`, `/dashboard`, `/generate`, `/flashcards`, `/api/*`.
- **Jakość i poprawność walidacji** (Zod + limity długości) oraz mapowania błędów w UI.
- **Bezpieczeństwo**: ochrona tras przez middleware, prawidłowe 401/redirect, brak wycieków danych między użytkownikami.
- **Poprawność integracji** z Supabase (auth + DB) i OpenRouter (success/timeout/rate limit/invalid output).
- **Niezawodność**: zachowanie w warunkach słabego łącza, timeoutów, błędów dostawcy AI.

---

### 2. Zakres testów

**W zakresie (must-have, zgodnie z kodem repo):**
- **Autentykacja (Supabase Auth)**:
  - `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
  - `POST /api/auth/reset-password`, `POST /api/auth/update-password`
  - widoki: `/auth/login`, `/auth/register`, `/auth/reset-password`
- **Autoryzacja i ochrona tras (Astro middleware)**:
  - ochrona prefixów: `/dashboard`, `/generate`, `/flashcards`, `/api/flashcards`, `/api/generations`
  - zachowanie dla API: 401 JSON; dla UI: redirect do `/auth/login?returnTo=...`
- **Generowanie fiszek (AI/OpenRouter lub fallback mock)**:
  - `POST /api/generations` (walidacja 1000–20000, limit dzienny, statusy generacji, obsługa low quality)
  - `GET /api/generations`, `GET /api/generations/:id`, `GET /api/generations/quota`
  - UI generowania: `/generate` (walidacja długości, blokady, retry, zapis wyników)
- **Kolekcja fiszek**:
  - `GET /api/flashcards` (paginacja/filtry/sort/search/since), `POST /api/flashcards`
  - `GET/PUT/DELETE /api/flashcards/:id`
  - UI kolekcji: `/flashcards` (create manual, edit, delete, paginacja, filtrowanie)
- **Dashboard**:
  - `/dashboard` oraz pobranie “ostatnich” danych poprzez API list (page=1,pageSize=5)

**Poza zakresem (na dziś, w kodzie brak implementacji tras/feature):**
- `/study` oraz `/account` – są w Topbar, ale brak stron w `src/pages`; w testach: **weryfikacja zachowania (np. 404/redirect) i zgłoszenie jako ryzyko/bug UX**.

---

### 3. Typy testów do przeprowadzenia

- **Testy jednostkowe (Unit) – Vitest**:
  - walidacje Zod (`src/lib/validation/*`)
  - logika domenowa serwisów (`src/lib/services/*`) z mockiem Supabase/OpenRouter (MSW)
  - utility functions i helpery
  - mapowanie błędów w kliencie (`src/components/*/api.ts`)
  
- **Testy integracyjne (Integration) – Vitest + MSW**:
  - API routes (`src/pages/api/**`) z mockowanymi zależnościami zewnętrznymi
  - integracja middleware + cookies + Supabase SSR (`createSupabaseServerInstance`)
  - flow autoryzacji i sesji
  
- **Testy E2E (UI, krytyczne ścieżki) – Playwright**:
  - pełne scenariusze user journey: rejestracja → login → generowanie → weryfikacja → zapis → kolekcja (edit/delete)
  - reset hasła: request → link (symulacja token/code) → update → logout → login nowym hasłem
  - interakcje z komponentami React w kontekście Astro (formularze, dialogi, nawigacja)
  - testy na wielu przeglądarkach (Chromium/Firefox/WebKit)
  
- **Testy kontraktowe API (Contract) – Playwright API testing**:
  - stabilność schematów odpowiedzi i kodów (200/201/204/400/401/403/404/422/500)
  - walidacja pól DTO: `DailyLimitDto`, `FlashcardDto`, `GenerationDto`
  - zgodność z typami TypeScript
  
- **Testy bezpieczeństwa (Security) – Playwright + Vitest**:
  - izolacja danych między użytkownikami (GET/PUT/DELETE obcego `id`)
  - poprawne wymuszanie auth na prefixach, poprawność `returnTo` (sanityzacja)
  - kontrola ujawniania informacji (404 vs 403, komunikaty błędów)
  
- **Testy niefunkcjonalne**:
  - **wydajność** (Playwright): listy/paginacja, czas generowania i timeouty (UI ma 45s, OpenRouter domyślnie 30s)
  - **odporność** (Vitest + MSW): błędy sieci, 429/5xx dostawcy AI, invalid JSON output
  - **a11y** (@axe-core/playwright): aria-live, aria-current, fokus w dialogach (Shadcn/Radix), kontrast kolorów, nawigacja klawiaturą
  - **kompatybilność** (Playwright): Chrome/Firefox/WebKit (smoke tests)

---

### 4. Scenariusze testowe dla kluczowych funkcjonalności

> **Legenda narzędzi**: 
> - 🎭 Playwright E2E | ⚡ Vitest Unit/Integration | 🎯 MSW Mocking

#### 4.1. Middleware: ochrona tras i zachowanie sesji [🎭 Playwright]

- **P0 – Brak sesji → wejście na trasę chronioną (UI)**
  - **Kroki**: otwórz `/dashboard` (analogicznie `/generate`, `/flashcards`)
  - **Oczekiwane**: redirect do `/auth/login?returnTo=<oryginalna_ścieżka_z_query>`
- **P0 – Brak sesji → wywołanie API chronionego**
  - **Kroki**: `GET /api/flashcards`, `POST /api/generations`
  - **Oczekiwane**: 401 JSON `{ code: "unauthorized", message: ... }`
- **P0 – Jest sesja → wejście na “guest only”**
  - **Kroki**: zaloguj się, wejdź na `/auth/login`
  - **Oczekiwane**: redirect do `/dashboard` (lub `returnTo` po sanityzacji)
- **P0 – `returnTo` sanitization**
  - **Kroki**: `returnTo` ustawione na pełny URL zewnętrzny / podejrzany (`//evil.com`, `https://...`)
  - **Oczekiwane**: brak open redirect (powrót do bezpiecznej ścieżki lokalnej)

#### 4.2. Auth: rejestracja, logowanie, wylogowanie [🎭 Playwright + ⚡ Vitest]

- **P0 – Rejestracja poprawna (JSON)**
  - **Dane**: email unikalny, hasło ≥ 8, potwierdzenie zgodne
  - **Oczekiwane**: 200 `{ redirectTo }`, sesja ustawiona (cookie), wejście na `/dashboard`
- **P0 – Rejestracja: email zajęty**
  - **Oczekiwane**: 400 z komunikatem “Użytkownik o takim adresie email już istnieje.” (lub redirect z `error=user_exists` przy form-post)
- **P0 – Logowanie: poprawne dane**
  - **Oczekiwane**: 200 `{ redirectTo }`, sesja, możliwość wejścia na `/generate`
- **P0 – Logowanie: złe hasło**
  - **Oczekiwane**: 400 `{ error: "Nieprawidłowy email lub hasło." }` oraz w UI komunikat zmapowany
- **P0 – Wylogowanie**
  - **Oczekiwane**: 200 `{ redirectTo }` lub 303 redirect (form) + brak dostępu do tras chronionych po wylogowaniu

#### 4.3. Reset hasła (request + token/code + update) [🎭 Playwright]

- **P0 – Request resetu hasła**
  - **Kroki**: `/auth/reset-password` → wpisz email → submit
  - **Oczekiwane**: komunikat “Jeśli konto istnieje…” niezależnie od istnienia konta (brak enumeracji użytkowników)
- **P0 – Wejście z parametrem `code` (exchangeCodeForSession)**
  - **Kroki**: otwórz `/auth/reset-password?code=...`
  - **Oczekiwane**: ustawienie sesji recovery + redirect do `mode=update` lub błąd `invalid_recovery`
- **P0 – Wejście z `token_hash`/`type=recovery` (verifyOtp)**
  - **Oczekiwane**: analogicznie jak wyżej
- **P0 – Ustawienie nowego hasła**
  - **Kroki**: w `mode=update` submit do `POST /api/auth/update-password`
  - **Oczekiwane**: 200 `{ redirectTo: "/auth/login" }`, następnie automatyczne wylogowanie (server signOut), logowanie nowym hasłem działa
- **P0 – Wygasła/Brak sesji recovery**
  - **Oczekiwane**: 401 + komunikat o wygaśnięciu; w UI mapowanie na “Link resetu… wygasł.”

#### 4.4. Generowanie fiszek (API + UI) [🎭 Playwright + ⚡ Vitest + 🎯 MSW]

- **P0 – Walidacja długości wejścia (UI i API)**
  - **Kroki**: wpisz <1000 lub >20000 znaków, kliknij “Generuj”
  - **Oczekiwane**: przycisk disabled; API zwraca 400 “text must be …” jeśli wywołane ręcznie
- **P0 – Start generacji: sukces (mock lub OpenRouter)**
  - **Oczekiwane**:
    - 201 z `generation.id`, `proposals[]`, `dailyLimit`
    - UI: pokazuje panel weryfikacji propozycji
- **P0 – Low quality input**
  - **Warunek**: dostawca zwraca “low_quality” lub invalid output
  - **Oczekiwane**: 422 `{ code: "low_quality_input", message, remaining }`, UI: czytelny komunikat i brak zapisania propozycji
- **P0 – Limit dzienny**
  - **Kroki**: doprowadź do `remaining=0`, ponów generowanie
  - **Oczekiwane**: 403 `daily_limit_exceeded` + `resetsAtUtc`, UI: blokada generowania + komunikat z datą odnowienia
- **P0 – Błąd dostawcy / timeout / 429**
  - **Oczekiwane**: 500 `provider_error` (lub odpowiednie mapowanie), UI: retry dostępne tam gdzie `canRetry=true`
- **P1 – Spójność zapisów generacji**
  - **Kroki**: po sukcesie sprawdź `GET /api/generations/:id`
  - **Oczekiwane**: status `succeeded`, `generatedCount` zgodne z `proposals.length`, `finishedAt` ustawione

#### 4.5. Weryfikacja i zapis propozycji jako fiszki (UI + API) [🎭 Playwright]

- **P0 – Akceptacja bez zmian**
  - **Kroki**: “Accept” bez edycji, “Zapisz zatwierdzone”
  - **Oczekiwane**: `POST /api/flashcards` tworzy rekordy ze `source="ai"` i poprawnym `generationId`
- **P0 – Edycja i akceptacja**
  - **Kroki**: edytuj front/back, “Zapisz i zaakceptuj”
  - **Oczekiwane**: zapis z `source="ai-edited"`, brak przekroczeń limitów 200/500 znaków
- **P0 – Zapis “all” vs “approved”**
  - **Oczekiwane**:
    - “all” zapisuje wszystkie poza `rejected`
    - “approved” zapisuje tylko `accepted_*`
- **P0 – Błędy zapisu (401/403/400/500)**
  - **Oczekiwane**: poprawne komunikaty i (dla 401) redirect do logowania

#### 4.6. Kolekcja fiszek (CRUD + listowanie) [🎭 Playwright + ⚡ Vitest]

- **P0 – Lista fiszek (paginacja/sort)**
  - **Kroki**: `GET /api/flashcards?page=1&pageSize=20&sort=updatedAt&order=desc`
  - **Oczekiwane**: stabilny kontrakt `FlashcardListResponse` + `total`, poprawna kolejność
- **P1 – Filtry i wyszukiwanie**
  - **source**: `ai`, `ai-edited`, `manual`
  - **search**: dopasowanie `front`/`back` (ilike)
  - **since**: `updated_at >= since`
  - **Oczekiwane**: wyniki zgodne z parametrami; brak błędów dla braku wyników
- **P0 – Tworzenie manualnej fiszki**
  - **Kroki**: dialog “Dodaj fiszkę”, submit
  - **Oczekiwane**: `source="manual"`, `generationId=null`, widoczna na liście
- **P0 – Edycja fiszki**
  - **Kroki**: `PUT /api/flashcards/:id` z front/back
  - **Oczekiwane**:
    - 200 `UpdateFlashcardResponse`
    - `updatedAt` zmienia się
    - jeśli fiszka była `ai` i została zmieniona → źródło przechodzi na `ai-edited` (logika serwisu)
- **P0 – Usuwanie fiszki**
  - **Kroki**: potwierdź delete
  - **Oczekiwane**: 204; ponowny delete zwraca 404 lub jest traktowany idempotentnie w UI (UI akceptuje 404 jako “już usunięta”)
- **P0 – Izolacja danych (cross-user)**
  - **Kroki**: user A próbuje `GET/PUT/DELETE` fiszki usera B
  - **Oczekiwane**: 404 (nie ujawnia istnienia) lub 403 w zależności od ścieżki; brak możliwości modyfikacji

#### 4.7. Dashboard [🎭 Playwright]

- **P1 – Widżety “ostatnie fiszki” i “ostatnie generacje”**
  - **Kroki**: wejdź na `/dashboard`
  - **Oczekiwane**: poprawne stany: loading → empty/success/error; retry działa
- **P1 – Obsługa 401**
  - **Kroki**: wygaś sesję i odśwież dashboard
  - **Oczekiwane**: redirect do `/auth/login?returnTo=/dashboard`

#### 4.8. Nawigacja i brakujące trasy [🎭 Playwright]

- **P1 – Topbar linki**
  - **Kroki**: kliknij `/dashboard`, `/generate`, `/flashcards`
  - **Oczekiwane**: działają + `aria-current="page"` dla aktywnego
- **P2 – `/study`, `/account`**
  - **Oczekiwane**: zdefiniowane zachowanie (obecnie prawdopodobnie 404) – zgłosić jako **gap** do backlogu lub ukryć linki do czasu implementacji.

---

### 5. Środowisko testowe

- **Środowiska**:
  - **Local Dev**: `npm run dev` (Astro SSR), Supabase lokalne (CLI) z migracjami
  - **Test/Staging**: osobny projekt Supabase + oddzielne klucze, kontrolowane limity AI
  - **CI**: uruchamianie testów automatycznie (lint/build + unit + integration + smoke e2e)

- **Dane testowe**:
  - Co najmniej 2 użytkowników: **UserA**, **UserB** do testów izolacji
  - Zestaw generacji: pending/succeeded/failed; fiszki: manual/ai/ai-edited
  - Seed scripts dla powtarzalnych stanów testowych

- **Konfiguracja zewnętrzna**:
  - **Supabase**: `SUPABASE_URL` + klucz anon (uwaga na spójność nazwy zmiennej z kodem)
  - **OpenRouter**:
    - Tryb unit/integration: MSW mockuje wszystkie requesty (deterministyczny, szybki, bez kosztów)
    - Tryb E2E staging: prawdziwy `OPENROUTER_API_KEY` + rate limiting (kontrolowane koszty)
  - **MSW handlers**: 
    - Osobne pliki dla success/error/timeout scenarios
    - `src/mocks/handlers.ts` z mockowanymi responses dla OpenRouter i Supabase
  - **Playwright config**:
    - Base URL wskazujący na local/test environment
    - Storage state dla pre-authenticated sessions (szybsze testy)
    - Screenshots/videos tylko dla failed tests (oszczędność miejsca)

---

### 6. Narzędzia do testowania

- **Unit/Integration (TypeScript)**:
  - **Vitest** + **@vitest/coverage-v8** + **@vitest/ui**
    - Natywne wsparcie dla Vite/Astro, szybsze niż Jest
    - Doskonała integracja z TypeScript i ESM
  - **MSW 2.x** (Mock Service Worker)
    - Mockowanie HTTP/OpenRouter w testach
    - Nowoczesne API oparte na fetch (zamiast przestarzałego nock)
    - Działa identycznie w Node.js i przeglądarce
  - Testy schematów: **Zod** (już w projekcie)

- **E2E**:
  - **Playwright**
    - Testy UI + API w przeglądarce
    - Równoległe wykonywanie na Chromium/Firefox/WebKit
    - Wbudowane auto-waiting, trace viewer, lepszy debug
  - **@axe-core/playwright**
    - Automatyczne testy a11y zintegrowane z E2E
    - Szybsze i bardziej deterministyczne niż Lighthouse w CI
    - Industry standard dla accessibility testing

- **API/Manual**:
  - **Bruno** (rekomendowane)
    - Offline-first, collections w git (bez clouda)
    - Współdzielenie testów API w zespole przez repo
    - Nowoczesna alternatywa dla Postman
  - Alternatywa: **Hoppscotch** (open-source, szybki)

- **Jakość i statyka**:
  - **ESLint/Prettier** (już są) jako brama jakości w CI
  - **axe-core** dla automatycznych testów a11y w CI/CD
  - **Lighthouse** (opcjonalnie) dla manualnych audytów wydajności/a11y

---

### 6.1. Uzasadnienie wyborów technologicznych

**Dlaczego Vitest zamiast Jest?**
- Natywne wsparcie dla Vite (używanego przez Astro 5)
- 5-10x szybsze wykonanie testów
- Zero konfiguracji dla TypeScript i ESM
- Kompatybilne API z Jest (łatwa migracja w przyszłości)

**Dlaczego MSW zamiast nock?**
- Nowoczesne API oparte na fetch (nock używa przestarzałych callbacks)
- Działa identycznie w Node.js i przeglądarce (możliwość użycia w Storybook)
- Lepsze wsparcie dla async/await i TypeScript
- Aktywny rozwój i community support (nock jest w maintenance mode)

**Dlaczego Playwright?**
- Najlepsze wsparcie dla SSR/SSG aplikacji (Astro)
- Wbudowane auto-waiting (brak flaky testów)
- Trace viewer i debug tools na wysokim poziomie
- Równoległe testy na wielu przeglądarkach out-of-the-box
- API testing zintegrowane z E2E

**Dlaczego @axe-core/playwright?**
- Industry standard dla a11y (używany przez Lighthouse)
- Szybkie i deterministyczne (bez overhead Lighthouse w CI)
- Automatyczna integracja z testami E2E
- Szczegółowe raporty naruszeń WCAG

**Dlaczego Bruno zamiast Postman?**
- Collections w git (współdzielenie w zespole, version control)
- Offline-first (nie wymaga rejestracji ani clouda)
- Lightweight i szybki
- Format plików czytelny dla ludzi (łatwy review w PR)

**Brak zmian w kodzie aplikacji:**
Wszystkie wymienione narzędzia są wyłącznie dev dependencies i nie wymagają modyfikacji produkcyjnego kodu. Można je wdrożyć bez refactoringu istniejącej logiki biznesowej.

---

### 7. Harmonogram testów (propozycja dla iteracji 2–3 tygodnie)

- **Setup (dzień 0-1)**
  - Instalacja i konfiguracja: Vitest + @vitest/coverage-v8 + MSW
  - Instalacja i konfiguracja: Playwright + @axe-core/playwright
  - Instalacja Bruno i import przykładowych requestów API
  - Przygotowanie środowiska testowego (Supabase lokalne/test)

- **Tydzień 1**
  - **P0 Unit**: testy jednostkowe walidacji Zod i serwisów z MSW
  - **P0 E2E**: smoke tests (register/login/logout + ochrona tras)
  - **P0 Contract**: kontrakty API dla auth/flashcards/generations (Playwright API)
  
- **Tydzień 2**
  - **P0/P1 E2E**: generowanie → weryfikacja → zapis → kolekcja (edit/delete)
  - **Security**: izolacja danych (UserA vs UserB), open redirect, 401 zachowania
  - **A11y**: integracja axe-core w kluczowych testach E2E
  
- **Tydzień 3 (stabilizacja)**
  - **Niefunkcjonalne**: timeouty, błędy sieci, 429/5xx z MSW
  - **A11y**: rozszerzenie testów axe-core na wszystkie formularze i dialogi
  - **Performance**: podstawowe smoke testy wydajności (page load, API response time)
  - **Compatibility**: uruchomienie smoke testów na Firefox/WebKit

---

### 8. Kryteria akceptacji testów

- **Kryteria wejścia (Entry)**
  - Build przechodzi (`npm run build`), lint przechodzi (`npm run lint`)
  - Środowisko testowe ma działającą bazę i poprawne zmienne env
  - Vitest i Playwright skonfigurowane i działają (`npm test`, `npm run test:e2e`)
  - MSW handlers przygotowane dla kluczowych scenarios

- **Kryteria wyjścia (Exit)**
  - **Testy funkcjonalne**:
    - 100% przypadków **P0**: PASS
    - Minimum 90% przypadków **P1**: PASS
  - **Code coverage** (Vitest):
    - Funkcje: ≥ 80% (walidacje, serwisy)
    - Linie: ≥ 75%
    - Priorytet: walidacje Zod i logika biznesowa w serwisach
  - **Bezpieczeństwo**:
    - Brak krytycznych defektów (wyciek danych, obejście auth, open redirect)
    - Wszystkie testy izolacji danych (UserA vs UserB): PASS
  - **API Contracts**:
    - Stabilne kontrakty: brak nieuzasadnionych zmian w statusach/kształcie odpowiedzi
    - Walidacja TypeScript types dla wszystkich DTOs
  - **A11y** (axe-core):
    - Brak critical/serious violations na kluczowych stronach
    - Minimum: formularze auth, dashboard, generowanie, kolekcja
  - **Compatibility**:
    - E2E smoke na Chromium: PASS (wymagane)
    - E2E smoke na Firefox/WebKit: PASS (nice to have)
  - **CI/CD**:
    - Wszystkie testy przechodzą w pipeline
    - Czas wykonania full suite < 10 minut

---

### 9. Role i odpowiedzialności w procesie testowania

- **QA Engineer**
  - projekt planu, przypadki testowe, automatyzacja E2E/contract, regresja, raporty jakości
- **Backend/Fullstack Developer**
  - poprawki defektów, wsparcie w seedingu danych, mockowaniu OpenRouter, stabilizacja API
- **Frontend Developer**
  - poprawki UI/a11y, stabilizacja mapowania błędów, testowalność komponentów
- **Tech Lead / Product Owner**
  - priorytety defektów, decyzje o ryzykach (np. RLS/policies), kryteria release

---

### 10. Procedury raportowania błędów

- **Kanał**: GitHub Issues (lub system zespołu), z etykietami: `P0/P1/P2`, `frontend/backend/security`, `regression`, `needs-investigation`.
- **Wymagane pola zgłoszenia**:
  - **Tytuł**: krótko + moduł (np. “P0 Auth: open redirect w returnTo”)
  - **Środowisko**: local/staging/CI, commit SHA, przeglądarka
  - **Kroki reprodukcji** (dokładne)
  - **Oczekiwane vs Rzeczywiste**
  - **Załączniki**: logi (bez sekretów), HAR/screenshot/video (dla E2E)
  - **Wpływ i ryzyko**: bezpieczeństwo/dane/finanse (OpenRouter)
- **SLA triage (propozycja)**:
  - **P0**: reakcja < 24h, fix przed release
  - **P1**: reakcja < 72h, fix w iteracji
  - **P2**: backlog / gdy czas pozwoli

---

### 11. Quick Start: Setup narzędzi testowych

#### 11.1. Instalacja dependencies

```bash
# Unit/Integration testing
npm install -D vitest @vitest/coverage-v8 @vitest/ui

# MSW dla mockowania HTTP
npm install -D msw@latest

# E2E testing
npm install -D @playwright/test
npm install -D @axe-core/playwright

# Inicjalizacja Playwright (browsers)
npx playwright install
```

#### 11.2. Konfiguracja Vitest

Utworzyć `vitest.config.ts` w root:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/**', 'src/pages/api/**'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/mocks/**'],
    },
  },
});
```

#### 11.3. Setup MSW

Utworzyć `src/mocks/handlers.ts`:

```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock OpenRouter success
  http.post('https://openrouter.ai/api/v1/chat/completions', () => {
    return HttpResponse.json({
      choices: [{ message: { content: '...' } }],
    });
  }),
  
  // Mock OpenRouter rate limit
  http.post('https://openrouter.ai/api/v1/chat/completions', () => {
    return HttpResponse.json({ error: 'rate_limit' }, { status: 429 });
  }),
];
```

#### 11.4. Konfiguracja Playwright

Utworzyć `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run dev',
    port: 4321,
    reuseExistingServer: !process.env.CI,
  },
});
```

#### 11.5. Scripts w package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

#### 11.6. Bruno setup

1. Pobierz Bruno z https://www.usebruno.com/
2. Utwórz folder `bruno/` w repo (dodaj do `.gitignore` tylko secrets)
3. Import przykładowych requestów dla każdego endpointa API
4. Współdziel collections przez git

#### 11.7. Pierwszy test (przykład)

**Unit test** (`src/lib/validation/__tests__/generation.test.ts`):

```typescript
import { describe, it, expect } from 'vitest';
import { generationInputSchema } from '../generation';

describe('generationInputSchema', () => {
  it('accepts valid input', () => {
    const result = generationInputSchema.safeParse({
      text: 'A'.repeat(1500),
    });
    expect(result.success).toBe(true);
  });

  it('rejects too short input', () => {
    const result = generationInputSchema.safeParse({
      text: 'A'.repeat(500),
    });
    expect(result.success).toBe(false);
  });
});
```

**E2E test** (`tests/e2e/auth.spec.ts`):

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('login flow', async ({ page }) => {
  await page.goto('/auth/login');
  
  // A11y check
  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
  
  // Functional test
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL('/dashboard');
});
```
