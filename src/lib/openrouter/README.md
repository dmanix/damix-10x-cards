# OpenRouter Service

Warstwa integracyjna dla API OpenRouter, umożliwiająca bezpieczne i ustandaryzowane wywoływanie modeli LLM.

## Struktura

```
src/lib/openrouter/
├── README.md                    # Dokumentacja (ten plik)
├── openrouter.types.ts          # Typy i klasy błędów
└── openRouterService.ts         # Główna klasa serwisu
```

## Konfiguracja

### Zmienne środowiskowe

Wymagane zmienne w pliku `.env`:

```bash
# OpenRouter API Key (wymagane)
# Uzyskaj klucz na: https://openrouter.ai/keys
OPENROUTER_API_KEY=your_api_key_here

# Domyślny model (opcjonalne, domyślnie: openai/gpt-4o-mini)
OPENROUTER_DEFAULT_MODEL=openai/gpt-4o-mini

# Identyfikacja aplikacji (opcjonalne, zalecane)
PUBLIC_APP_NAME=damix-10x-cards
PUBLIC_APP_URL=https://your-domain.com
```

### Typy w TypeScript

Typy są zdefiniowane w `src/env.d.ts`:

```typescript
interface ImportMetaEnv {
  readonly OPENROUTER_API_KEY: string;
  readonly OPENROUTER_DEFAULT_MODEL?: string;
  readonly PUBLIC_APP_NAME?: string;
  readonly PUBLIC_APP_URL?: string;
}
```

## Użycie

### Podstawowa inicjalizacja

```typescript
import { OpenRouterService } from "./lib/openrouter/openRouterService";

const service = new OpenRouterService({
  apiKey: import.meta.env.OPENROUTER_API_KEY,
  defaultModel: "openai/gpt-4o-mini",
  timeoutMs: 30000,
  appName: "My App",
  appUrl: "https://myapp.com",
});
```

### Chat Completion (zwykły tekst)

```typescript
const result = await service.createChatCompletion({
  messages: [
    { role: "system", content: "Jesteś pomocnym asystentem." },
    { role: "user", content: "Wyjaśnij czym jest TypeScript." },
  ],
  params: {
    temperature: 0.7,
    max_tokens: 500,
  },
});

console.log(result.text);
console.log(result.usage); // token usage
```

### Structured Completion (JSON Schema)

```typescript
import { validateFlashcardsGenerationDTO } from "./lib/validation/openrouter";

const result = await service.createStructuredCompletion({
  messages: [
    { role: "system", content: "Generate flashcards in JSON format." },
    { role: "user", content: "Create flashcards about TypeScript." },
  ],
  responseFormat: flashcardsResponseFormat,
  validate: (data) => {
    const validation = validateFlashcardsGenerationDTO(data);
    if (!validation.success) {
      throw new Error("Validation failed");
    }
    return validation.data;
  },
  params: {
    temperature: 0.2,
    max_tokens: 2000,
  },
});

console.log(result.data); // Validated flashcards
console.log(result.rawText); // Raw JSON string
```

### Health Check

```typescript
const health = await service.healthCheck();
if (health.status === "ok") {
  console.log("OpenRouter is ready");
} else {
  console.error("OpenRouter error:", health.message);
}
```

## Obsługa błędów

Serwis rzuca specyficzne typy błędów zdefiniowane w `openrouter.types.ts`:

### OpenRouterConfigError

Błąd konfiguracji (brak API key, nieprawidłowy model).

```typescript
try {
  const service = new OpenRouterService({
    apiKey: "", // Pusty klucz
    defaultModel: "openai/gpt-4o-mini",
  });
} catch (error) {
  if (error instanceof OpenRouterConfigError) {
    console.error("Configuration error:", error.message);
  }
}
```

### OpenRouterTimeoutError

Przekroczenie limitu czasu żądania.

```typescript
try {
  const result = await service.createChatCompletion(input);
} catch (error) {
  if (error instanceof OpenRouterTimeoutError) {
    console.error("Request timed out:", error.message);
    // Możesz spróbować ponownie lub zwrócić błąd użytkownikowi
  }
}
```

### OpenRouterUpstreamError

Błędy po stronie OpenRouter (401, 403, 429, 5xx).

```typescript
try {
  const result = await service.createChatCompletion(input);
} catch (error) {
  if (error instanceof OpenRouterUpstreamError) {
    console.error("Upstream error:", error.message);
    console.error("Status code:", error.status);
    console.error("Error code:", error.code);

    if (error.status === 429) {
      // Rate limiting
      console.log("Rate limited, retry after some time");
    } else if (error.status === 401 || error.status === 403) {
      // Authentication error
      console.log("Check your API key");
    }
  }
}
```

### OpenRouterInvalidResponseError

Odpowiedź nie zawiera oczekiwanej struktury.

```typescript
try {
  const result = await service.createChatCompletion(input);
} catch (error) {
  if (error instanceof OpenRouterInvalidResponseError) {
    console.error("Invalid response structure:", error.message);
  }
}
```

### OpenRouterInvalidOutputError

Model zwrócił dane niezgodne z oczekiwaniami (np. nieprawidłowy JSON).

```typescript
try {
  const result = await service.createStructuredCompletion(input);
} catch (error) {
  if (error instanceof OpenRouterInvalidOutputError) {
    console.error("Model output validation failed:", error.message);
    console.error("Validation error:", error.validationError);
  }
}
```

## Integracja z GenerationService

OpenRouterService jest używany przez `GenerationService` do generowania fiszek:

```typescript
import { GenerationService } from "./lib/services/generationService";
import { OpenRouterService } from "./lib/openrouter/openRouterService";

const openRouter = new OpenRouterService({
  apiKey: import.meta.env.OPENROUTER_API_KEY,
  defaultModel: "openai/gpt-4o-mini",
});

const generationService = new GenerationService(
  supabase,
  undefined, // now function (default: () => new Date())
  openRouter // optional OpenRouterService
);

// Użycie prawdziwego providera (jeśli openRouter jest przekazany)
const result = await generationService.runGenerationProvider(inputSnapshot);

// Użycie mock providera (dla testów/deweloperki)
const mockResult = await generationService.runMockGenerationProvider(inputSnapshot);
```

## Bezpieczeństwo

### Sekrety

- **NIGDY** nie przekazuj `OPENROUTER_API_KEY` do frontendu
- Klucz API jest używany wyłącznie po stronie serwera (Astro API routes)
- Nie loguj klucza API ani pełnych promptów w produkcji

### Rate Limiting

- OpenRouter może zwrócić błąd 429 (rate limited)
- Zaimplementuj własne rate limiting na poziomie aplikacji (middleware lub endpoint)
- Rozważ użycie kolejki dla żądań

### Walidacja danych

- Zawsze waliduj dane wejściowe od użytkownika (Zod)
- Waliduj dane wyjściowe od modelu (JSON Schema + Zod)
- Nie ufaj bezpośrednio wynikom z AI - zawsze waliduj

### Ochrona przed prompt injection

- System message jest kontrolowany przez backend (nie od użytkownika)
- Treści użytkownika są traktowane jako nieufne
- Wymuszaj `response_format` dla structured completions

## Testowanie

### Dependency Injection

Serwis przyjmuje opcjonalny parametr `fetchImpl` dla testów:

```typescript
// Mock fetch dla testów jednostkowych
const mockFetch = vi.fn();
const service = new OpenRouterService(config, mockFetch);
```

### Health Check

Użyj `healthCheck()` w testach integracyjnych i CI/CD:

```typescript
const health = await service.healthCheck();
expect(health.status).toBe("ok");
```

### Fallback na Mock

W endpointach API można użyć fallback na mock provider:

```typescript
const providerResult = openRouterService
  ? await service.runGenerationProvider(input)
  : await service.runMockGenerationProvider(input);
```

## Modele

### Popularne modele

- `openai/gpt-4o-mini` - szybki i ekonomiczny (zalecany domyślnie)
- `openai/gpt-4o` - bardziej zaawansowany
- `anthropic/claude-3.5-sonnet` - alternatywa Claude
- `google/gemini-pro` - alternatywa Google

### Parametry

- `temperature` (0-2): kontrola kreatywności (0 = deterministyczny, 2 = bardzo kreatywny)
- `top_p` (0-1): nucleus sampling
- `max_tokens`: maksymalna długość odpowiedzi

### Zalecenia dla flashcards

```typescript
{
  temperature: 0.2,  // Niska dla spójności
  max_tokens: 2000,  // Wystarczająco dla 5-10 fiszek
}
```

## Logowanie

Użyj `safeLogContext()` do bezpiecznego logowania:

```typescript
const logContext = service.safeLogContext({
  model: "openai/gpt-4o-mini",
  status: 200,
  durationMs: 1234,
  requestId: "req-123",
});

console.log("OpenRouter request completed:", logContext);
// Output: { service: "OpenRouter", model: "...", status: 200, ... }
```

**Nie loguj:**

- Klucza API
- Pełnych promptów użytkownika (mogą zawierać PII)
- Pełnych odpowiedzi modelu

## Limity i koszty

- OpenRouter pobiera opłaty według użycia (per token)
- Monitoruj `usage` w odpowiedziach aby śledzić koszty
- Ustaw odpowiednie `max_tokens` aby kontrolować koszty
- Rozważ implementację budżetów i alertów

## Troubleshooting

### "OpenRouterService is not configured"

Sprawdź czy `OPENROUTER_API_KEY` jest ustawiony w `.env`.

### "Authentication error"

Sprawdź czy klucz API jest poprawny na https://openrouter.ai/keys.

### "Rate limited"

Poczekaj chwilę lub zwiększ limit na koncie OpenRouter.

### "Request timed out"

Zwiększ `timeoutMs` w konfiguracji lub zoptymalizuj prompt (krótszy tekst).

### "Model output validation failed"

Model zwrócił dane niezgodne ze schematem. Sprawdź czy:

- System message jasno definiuje oczekiwany format
- `response_format` jest poprawnie zdefiniowany
- Model obsługuje `json_schema` (np. GPT-4o, Claude 3.5)

## Dokumentacja API

Pełna dokumentacja OpenRouter API: https://openrouter.ai/docs
