## 1. Opis usługi

Usługa **OpenRouter** (dalej: `OpenRouterService`) to warstwa integracyjna w `src/lib`, której zadaniem jest:

- bezpieczne i ustandaryzowane wywoływanie API `openrouter.ai` (tryb czatu / chat completions),
- wspieranie czatów opartych na LLM: budowanie wiadomości (system/user), parametrów modelu i walidacja odpowiedzi,
- dostarczanie wyższego poziomu abstrakcji dla endpointów Astro w `src/pages/api` oraz dla logiki domenowej (np. generowanie treści, analizy, podsumowania),
- zapewnienie spójnej obsługi błędów, limitów i logowania.

### Kluczowe komponenty usługi (komponenty logiczne)

1. **Konfiguracja i zarządzanie kluczem API**
   - **Funkcjonalność**: wczytanie `OPENROUTER_API_KEY` i parametrów domyślnych (np. model, timeout), walidacja konfiguracji przy starcie/konstruowaniu serwisu, izolacja klucza (nigdy nie zwracać do frontendu).
   - **Wyzwania**
     1. Brak klucza API lub błędna konfiguracja środowiska.
     2. Wycieki tajnych danych (logi, błędy, odpowiedzi API).
   - **Rozwiązania**
     1. Walidacja konfiguracji w konstruktorze i błąd typu „misconfiguration” z czytelnym komunikatem.
     2. Czerwone flagi w logowaniu: maskowanie kluczy, ograniczenie logowania promptów, rozdzielenie logów technicznych od danych użytkownika.

2. **Budowanie zapytania czatowego (messages + parametry modelu)**
   - **Funkcjonalność**: budowanie payloadu zgodnego z OpenAI-style chat, w tym `messages` (system/user), `model`, parametry (np. `temperature`, `max_tokens`), oraz opcjonalnie `response_format` do odpowiedzi ustrukturyzowanych.
   - **Wyzwania**
     1. Niespójny format wiadomości lub niepoprawne role.
     2. Różnice w obsłudze parametrów między modelami (np. brak wsparcia `response_format`).
   - **Rozwiązania**
     1. Typy i walidacja wejścia (Zod na granicy endpointu), plus normalizacja tekstów (trim, limit długości).
     2. Warstwa „capabilities”: fallback dla modeli bez `response_format` (np. instrukcje + walidacja JSON po stronie serwera).

3. **Transport HTTP i odporność (timeouts / retry / backoff)**
   - **Funkcjonalność**: wykonywanie żądań `fetch` do OpenRouter, ustawianie timeoutu, opcjonalne ponawianie dla błędów przejściowych, mapowanie statusów HTTP na błędy domenowe.
   - **Wyzwania**
     1. Timeouty i niestabilność sieci.
     2. Przeciążenie (429) i limity dostawcy.
     3. Błędy 5xx po stronie dostawcy.
   - **Rozwiązania**
     1. `AbortController` + limit czasu, zwracanie 504/502 do klienta zależnie od kontekstu.
     2. Retry z backoff i jitter tylko dla idempotentnych operacji (typowo: generowanie tekstu nie jest stricte idempotentne, więc retry powinien być kontrolowany i ograniczony; zalecany 1 retry maks).
     3. Rozróżnienie błędów: 5xx → „upstream_error”, 429 → „rate_limited”, z `Retry-After` jeśli dostępne.

4. **Walidacja i parsowanie odpowiedzi (w tym JSON Schema)**
   - **Funkcjonalność**: bezpieczne wyciąganie treści z odpowiedzi modelu, a przy `response_format` — walidacja struktury JSON (Zod/JSON Schema) i zwrot danych w typach TS.
   - **Wyzwania**
     1. Model zwraca niepoprawny JSON lub tekst zamiast JSON (mimo wymagań).
     2. Częściowe / niekompletne dane.
   - **Rozwiązania**
     1. Tryb „strict”: `response_format` + walidacja po stronie serwera i błąd „invalid_model_output”.
     2. Projekt schematów z polami opcjonalnymi tylko tam, gdzie to uzasadnione; wersjonowanie schematu.

5. **Interfejs publiczny serwisu (kontrakt dla reszty aplikacji)**
   - **Funkcjonalność**: prosty zestaw metod (np. `createChatCompletion`, `createStructuredCompletion`) wykorzystywany w `src/pages/api/*` oraz w serwisach domenowych.
   - **Wyzwania**
     1. „Rozlewanie się” szczegółów API OpenRouter po całej aplikacji.
     2. Trudna diagnostyka i brak spójnych błędów.
   - **Rozwiązania**
     1. Jedno wejście do OpenRouter przez `src/lib/openrouter/openRouterService.ts`.
     2. Wspólne typy błędów i wspólny serializer do JSON error response w endpointach.

6. **Observability (logowanie, metryki, korelacja)**
   - **Funkcjonalność**: logowanie zdarzeń technicznych (status, czas, model) bez wrażliwych danych, korelacja żądań (np. `requestId`), podstawowe metryki kosztów/zużycia (jeżeli OpenRouter zwraca usage).
   - **Wyzwania**
     1. Nadmierne logowanie promptów/PII.
     2. Brak korelacji błędów upstream z żądaniami klienta.
   - **Rozwiązania**
     1. Zasada „privacy by default”: logi bez treści promptów, ewentualnie hash/skrót.
     2. `requestId` na wejściu endpointu, przekazywany do serwisu i logów.

### Jak uwzględnić wymagane elementy payloadu OpenRouter (z przykładami)

Poniższe przykłady zakładają **OpenAI-compatible** endpoint czatu w OpenRouter:

- **URL**: `POST https://openrouter.ai/api/v1/chat/completions`
- **Nagłówki**:
  - `Authorization: Bearer <OPENROUTER_API_KEY>`
  - `Content-Type: application/json`
  - opcjonalnie (zalecane do identyfikacji aplikacji): `HTTP-Referer` oraz `X-Title` (wartości zależą od Twojej aplikacji/hostingu)

Kluczowe jest, by w serwisie zbudować payload w sposób deterministyczny i typowany.

#### Minimalny przykład requestu (server-side)

```ts
const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    // "HTTP-Referer": "https://twoja-domena.pl",
    // "X-Title": "damix-10x-cards",
  },
  body: JSON.stringify({
    model: "openai/gpt-4o-mini",
    messages: [
      { role: "system", content: "Odpowiadaj zwięźle i precyzyjnie." },
      { role: "user", content: "Napisz 3 zdania o Astro." },
    ],
    temperature: 0.7,
    max_tokens: 200,
  }),
});
```

1. **Komunikat systemowy (`system`)**
   - **Cel**: nadaje stałe zasady zachowania modelu (styl, ograniczenia, format odpowiedzi, zakazy).
   - **Przykład 1** (krótki, stabilny):

```ts
const systemMessage = {
  role: "system",
  content:
    "Jesteś asystentem. Odpowiadaj zwięźle. Jeśli nie wiesz, powiedz wprost. Nie ujawniaj kluczy ani danych wrażliwych.",
} as const;
```

2. **Komunikat użytkownika (`user`)**
   - **Cel**: zawiera bieżące zadanie od użytkownika (oraz ewentualny kontekst).
   - **Przykład 1**:

```ts
const userMessage = {
  role: "user",
  content: "Wyjaśnij różnicę między HTTP 401 i 403 oraz podaj przykład dla każdego.",
} as const;
```

3. **Ustrukturyzowane odpowiedzi przez `response_format` (JSON Schema)**
   - **Cel**: wymusza odpowiedź modelu w postaci JSON zgodnej ze schematem, co upraszcza parsowanie i walidację.
   - **Wzór wymagany**:
     - `{ type: 'json_schema', json_schema: { name: [schema-name], strict: true, schema: [schema-obj] } }`

   - **Przykład 1** (odpowiedź: lista propozycji wiadomości czatu):

```ts
const response_format = {
  type: "json_schema",
  json_schema: {
    name: "chat_assistant_reply",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["answer", "sources"],
      properties: {
        answer: { type: "string", minLength: 1 },
        sources: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "url"],
            properties: {
              title: { type: "string" },
              url: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const;
```

   - **Przykład 2** (odpowiedź: struktura „flashcards” – pokazuje praktyczny przypadek domenowy):

```ts
const response_format = {
  type: "json_schema",
  json_schema: {
    name: "flashcards_generation_v1",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["flashcards"],
      properties: {
        flashcards: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["front", "back"],
            properties: {
              front: { type: "string", minLength: 1 },
              back: { type: "string", minLength: 1 },
              tags: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
  },
} as const;
```

4. **Nazwa modelu (`model`)**
   - **Cel**: wybór konkretnego modelu przez OpenRouter (zależnie od jakości/kosztu/latencji i wymagań funkcji).
   - **Przykład 1** (model domyślny w konfiguracji serwisu):

```ts
const model = "openai/gpt-4o-mini"; // przykład; model powinien być konfigurowalny
```

   - **Przykład 2** (model per-request, np. do testów A/B):

```ts
const model = requestedModel ?? defaultModel;
```

5. **Parametry modelu (np. `temperature`, `max_tokens`, `top_p`)**
   - **Cel**: kontrola kreatywności i długości odpowiedzi; ustandaryzowanie ustawień dla danego typu zadania.
   - **Przykład 1** (bezpieczne domyślne parametry do zadań strukturalnych):

```ts
const modelParams = {
  temperature: 0.2,
  top_p: 1,
  max_tokens: 800,
} as const;
```

   - **Przykład 2** (parametry do luźniejszej rozmowy):

```ts
const modelParams = {
  temperature: 0.8,
  top_p: 0.95,
  max_tokens: 600,
} as const;
```

## 2. Opis konstruktora

Zalecana lokalizacja implementacji: `src/lib/openrouter/openRouterService.ts`.

### Konstruktor (proponowany kontrakt)

- **Wejście**:
  - `apiKey`: string (z env, np. `process.env.OPENROUTER_API_KEY`)
  - `baseUrl`: domyślnie `https://openrouter.ai/api/v1`
  - `defaultModel`: string
  - `timeoutMs`: number (np. 30_000)
  - `appName` oraz `appUrl` (opcjonalnie do nagłówków identyfikujących aplikację)
  - `fetchImpl` (opcjonalny injection do testów)
- **Zachowanie**:
  - waliduje `apiKey` i `defaultModel`,
  - ustawia wartości domyślne i przygotowuje stałe nagłówki.

### Konfiguracja środowiska

- **Wymagane zmienne**:
  - `OPENROUTER_API_KEY`
- **Opcjonalne**:
  - `OPENROUTER_DEFAULT_MODEL`
  - `OPENROUTER_TIMEOUT_MS`
  - `PUBLIC_APP_NAME` / `PUBLIC_APP_URL` (jeżeli chcesz przekazywać identyfikację aplikacji do OpenRouter; nie wkładać tam sekretów).

## 3. Publiczne metody i pola

Poniżej opis interfejsu publicznego serwisu (co powinien dostarczać developerom w projekcie).

### Publiczne pola (read-only)

- **`defaultModel`**: model używany, gdy per-request nie określono innego.
- **`baseUrl`**: baza API OpenRouter (domyślnie `https://openrouter.ai/api/v1`).
- **`timeoutMs`**: domyślny timeout dla żądań.

### Publiczne metody

1. **`createChatCompletion(input)`**
   - **Cel**: podstawowe wywołanie czatu bez wymuszonego JSON.
   - **Wejście**:
     - `messages`: lista wiadomości `{ role, content }` (min. 1 user message; system opcjonalny)
     - `model?`: string (fallback: `defaultModel`)
     - `params?`: parametry modelu
   - **Wyjście**:
     - `text`: string (zawartość odpowiedzi)
     - `raw`: surowa odpowiedź (opcjonalnie, ale ostrożnie; nie przekazywać do klienta bez filtracji)
     - `usage?`: metadane zużycia (jeżeli dostępne)

2. **`createStructuredCompletion<T>(input)`**
   - **Cel**: wywołanie czatu z `response_format` i walidacją odpowiedzi.
   - **Wejście**:
     - `messages`, `model?`, `params?` jak wyżej
     - `responseFormat`: obiekt wg wzoru `json_schema`
     - `validate`: funkcja walidująca (np. Zod parse) lub walidacja JSON Schema (wybór zależy od preferencji; ważne, by była deterministyczna)
   - **Wyjście**:
     - `data: T` (wynik zwalidowany)
     - `rawText`: string (do diagnostyki; nie logować wrażliwych danych)
     - `usage?`

3. **`healthCheck()`** (opcjonalnie)
   - **Cel**: weryfikacja poprawności konfiguracji i możliwość ping/krótkiego requestu (w środowisku dev/CI).
   - **Wyjście**: status + ewentualne informacje o konfiguracji (bez sekretów).

## 4. Prywatne metody i pola

### Prywatne pola

- **`apiKey`**: trzymany wyłącznie po stronie serwera (nigdy nie serializować do klienta).
- **`headersBase`**: gotowy zestaw nagłówków (Authorization, Content-Type oraz identyfikacja aplikacji, jeśli używana).
- **`fetchImpl`**: wstrzykiwany `fetch` dla testów.

### Prywatne metody

1. **`buildHeaders()`**
   - Buduje nagłówki, np.:
     - `Authorization: Bearer ${apiKey}`
     - `Content-Type: application/json`
     - opcjonalnie: nagłówki identyfikujące aplikację (dla polityk OpenRouter).

2. **`withTimeout(promise, timeoutMs)`**
   - Opakowuje request w `AbortController`.

3. **`requestJson<T>(path, body)`**
   - Wysyła żądanie, parsuje JSON, mapuje błędy upstream → błędy domenowe.

4. **`extractAssistantContent(response)`**
   - Wyciąga tekst odpowiedzi z pierwszego wyboru (lub obsługuje brak `choices` jako błąd „invalid_upstream_response”).

5. **`safeLogContext(ctx)`**
   - Zwraca obiekt do logów bez promptów/sekretów (np. model, status, durationMs, requestId).

## 5. Obsługa błędów

Zalecenie: użyć spójnych kodów błędów w endpointach (jak w `src/pages/api/flashcards.ts`) i mapować błędy serwisu na `jsonResponse(status, { code, message, details? })`.

### Potencjalne scenariusze błędów (numerowane)

1. **`invalid_request`**: klient wysłał niepoprawny JSON / brak wymaganych pól.
2. **`misconfiguration`**: brak `OPENROUTER_API_KEY` lub niepoprawna konfiguracja serwera.
3. **`upstream_rate_limited` (429)**: limit żądań po stronie OpenRouter / modelu.
4. **`upstream_auth_error` (401/403)**: niepoprawny klucz, brak uprawnień, przekroczone limity konta.
5. **`upstream_error` (5xx)**: błąd po stronie OpenRouter/modelu.
6. **`timeout`**: przekroczony czas oczekiwania na odpowiedź.
7. **`invalid_upstream_response`**: odpowiedź nie zawiera oczekiwanej struktury (np. brak `choices`).
8. **`invalid_model_output`**: model zwrócił treść niezgodną z oczekiwaniami (np. JSON niezgodny ze schematem).
9. **`payload_too_large`**: przekroczony limit rozmiaru promptu (lokalny guard lub 413 od upstream).
10. **`content_policy_violation`**: upstream odmówił odpowiedzi z powodów polityk treści (jeśli sygnalizowane).

### Zalecane mapowanie na HTTP

- **400**: `invalid_request`, `payload_too_large` (jeśli lokalny guard)
- **401/403**: `upstream_auth_error`
- **408/504**: `timeout` (zależnie od przyjętej semantyki)
- **422**: `invalid_model_output` (zwrócić informację, że odpowiedź modelu jest niepoprawna)
- **429**: `upstream_rate_limited`
- **502/503**: `upstream_error`, `invalid_upstream_response`
- **500**: `misconfiguration` (w produkcji możesz zwrócić 500 bez szczegółów, a szczegóły tylko w logach)

## 6. Kwestie bezpieczeństwa

- **Sekrety i env**
  - Trzymaj `OPENROUTER_API_KEY` wyłącznie po stronie serwera (Astro API routes / server runtime).
  - Nigdy nie zwracaj klucza API do frontendu ani nie zapisuj go w `PUBLIC_*`.
- **Ochrona przed prompt injection**
  - Traktuj treści użytkownika jako nieufne wejście; nie pozwól, by wpływały na politykę systemową (system message powinien być kontrolowany przez backend).
  - Jeśli model ma generować JSON, wymuszaj `response_format` + waliduj wynik; odrzucaj wszystko, co nie przechodzi walidacji.
- **Ograniczenia wejścia**
  - Limit długości wiadomości użytkownika (np. max znaków / tokenów w przybliżeniu).
  - Normalizacja: trim, usuwanie niepotrzebnych białych znaków.
- **Rate limiting**
  - Dodaj limitowanie po stronie API (na użytkownika/IP) w middleware lub w endpointach.
- **Logowanie i prywatność**
  - Nie loguj pełnych promptów i odpowiedzi (mogą zawierać PII).
  - Jeśli potrzebujesz debugowania: loguj skróty (hash) lub krótkie fragmenty po stronie dev.
- **Zaufanie do danych strukturalnych**
  - Nawet przy `strict: true` traktuj wynik jako dane od zewnętrznego systemu: walidacja i guardy są obowiązkowe.

## 7. Plan wdrożenia krok po kroku

### Krok 1: Ustal kontrakty typów i DTO

- Dodaj/uzupełnij typy w `src/types.ts` (lub osobnym module w `src/types.ts`, zależnie od praktyk repo):
  - `ChatMessageRole = "system" | "user" | "assistant"`
  - `ChatMessage { role: ChatMessageRole; content: string }`
  - DTO dla odpowiedzi ustrukturyzowanych (np. `FlashcardsGenerationDTO`).

### Krok 2: Zaimplementuj `OpenRouterService` w `src/lib/openrouter/openRouterService.ts`

- Konstruktor z walidacją konfiguracji (guard clauses).
- Metody:
  - `createChatCompletion`
  - `createStructuredCompletion`
- Prywatne helpery: timeout, requestJson, extract content, safe logging.

### Krok 3: Dodaj schematy walidacji (Zod) dla wejść/wyjść

- Wejście endpointu: waliduj body requestu w `src/lib/validation/*` (analogicznie do `validateCreateFlashcardsCommand`).
- Wyjście modelu:
  - jeśli `response_format`: waliduj zgodnie z oczekiwanym DTO (Zod) po sparsowaniu JSON.

### Krok 4: Dodaj endpoint API dla czatu (Astro)

- Utwórz `src/pages/api/chat.ts` (lub `src/pages/api/openrouter/chat.ts`, jeśli chcesz grupować endpointy).
- W endpointzie:
  - `export const prerender = false;`
  - parsowanie JSON z try/catch → `invalid_request`
  - walidacja Zod
  - utworzenie `OpenRouterService` z env
  - mapowanie wyjątków na spójne JSON response (kody jak w istniejących endpointach)

### Krok 5: Zintegruj z UI (Astro + React)

- Frontend wywołuje własny endpoint `POST /api/chat`, nigdy bezpośrednio OpenRouter (klucz zostaje na serwerze).
- Komponent React:
  - trzyma historię wiadomości,
  - wysyła `userMessage` + kontekst,
  - renderuje odpowiedź i obsługuje stany: loading/error.

### Krok 6: Ustal politykę modeli i parametrów

- Zdefiniuj domyślny model w env lub stałej konfiguracyjnej.
- Zdefiniuj profile parametrów:
  - „structured”: niska `temperature`, wymuszony `response_format`
  - „chat”: wyższa `temperature`, brak `response_format`
- Dodaj mechanizm override per-request (z allowlistą modeli, jeśli to wymagane).

### Krok 7: Dodaj retry/timeout i limity

- Timeout: np. 30s.
- Retry: maks. 1 ponowienie tylko dla `429/5xx` i tylko jeśli endpoint UI potrafi bezpiecznie powtórzyć (albo retry tylko w serwisie domenowym, nie w publicznym czacie).
- Limit długości promptu i liczby wiadomości w historii.

### Krok 8: Observability i diagnostyka

- Loguj zdarzenia techniczne:
  - `openrouter.request.start` / `openrouter.request.end`
  - `durationMs`, `status`, `model`, `requestId`
- Nie loguj treści rozmów w produkcji.


