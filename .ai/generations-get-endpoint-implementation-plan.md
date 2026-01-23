## API Endpoint Implementation Plan: Generations (GET endpoints)

> Uwaga dot. routingu w Astro: w tym repo endpointy znajdują się pod `src/pages/api/*`, więc realne ścieżki będą miały prefiks `/api` (np. `/api/generations`). W specyfikacji pomijamy prefiks, ale implementacja w kodzie powinna iść zgodnie ze strukturą `src/pages/api`.

### Wspólne założenia implementacyjne (dla wszystkich poniższych endpointów)

#### Autoryzacja (401)
- **Źródło tokenu**: `Authorization: Bearer <access_token>`.
- **Walidacja tokenu**:
  - Wyciągnąć token z nagłówka.
  - Zweryfikować usera przez Supabase Auth (np. `supabase.auth.getUser(token)` lub analogiczna metoda).
  - Jeśli brak tokenu / token nieprawidłowy / brak usera → `401`.
- **Dostęp do danych usera**: zapytania do tabel per-user (`generations`) wykonywać klientem Supabase skonfigurowanym z `Authorization: Bearer <token>`, aby RLS mogło zadziałać.

#### Dostęp do `app_config`
- Odczyt `public.app_config` jest dostępny dla każdego użytkownika (brak wymogu service role).

#### Format odpowiedzi i mapowanie pól
- DB (snake_case) → API (camelCase):
  - `created_at` → `createdAt`
  - `finished_at` → `finishedAt`
  - `generated_count` → `generatedCount`
  - `accepted_original_count` → `acceptedOriginalCount`
  - `accepted_edited_count` → `acceptedEditedCount`
  - `error_code` / `error_message` → `error: { code, message }`
- Nie zwracać pól nieujętych w spec (np. `input_hash`, `input_length`, `user_id`).

#### Walidacja wejścia (400)
- Implementować Zod w `src/lib/validation/`:
  - Dla query: coerces i defaulty.
  - Dla params: UUID.
- Błąd walidacji → `400` i stabilny format:
  - `{ "code": "invalid_request", "message": "<pierwszy błąd lub zwięzły opis>" }`

#### Logowanie
- Na błędach `500` logować `logger.error` z polami:
  - `event` (np. `"generations.list.failed"`)
  - `error` (name/message)
  - `userId` (jeśli dostępne)
  - `query`/`id` (jeśli dostępne, bez wrażliwych danych)

---

## Endpoint: GET `/generations`

### 1. Przegląd punktu końcowego
- Cel: pobranie historii generacji użytkownika (diagnostyka limitów, statusy, czasy zakończenia, liczniki).
- Zwraca wynik stronicowany z `total`.

### 2. Szczegóły żądania
- Metoda HTTP: `GET`
- Struktura URL (Astro): `/api/generations`
- Parametry:
  - **Wymagane**: brak (poza auth).
  - **Opcjonalne**:
    - `status?: "pending" | "succeeded" | "failed"`
    - `page?: number` (default `1`)
    - `pageSize?: number` (default `20`, max `100`)
    - `sort?: "createdAt" | "finishedAt"` (default `createdAt`)
    - `order?: "desc" | "asc"` (default `desc`)
- Body: brak

### 3. Wykorzystywane typy
- `GenerationListQuery` (wejście, po walidacji)
- `GenerationListResponse` (wyjście)
- `GenerationListItemDto` / `GenerationDto`
- `ErrorResponse` (dla błędów)

### 4. Szczegóły odpowiedzi
- `200 OK`

```json
{ "items": [ /* GenerationDto[] */ ], "page": 1, "pageSize": 20, "total": 123 }
```

### 5. Przepływ danych
1. Wyciągnięcie Bearer tokenu → weryfikacja usera (`401` jeśli brak/invalid).
2. Walidacja query Zod:
   - `page`/`pageSize` jako liczby całkowite \(\ge 1\), `pageSize <= 100`.
   - `status/sort/order` jako enumy.
3. Zapytanie do `public.generations` (RLS):
   - `select(...)` tylko potrzebne kolumny.
   - Filtr: implicitnie przez RLS + opcjonalnie `status`.
   - Sort:
     - `createdAt` → `created_at`
     - `finishedAt` → `finished_at` (z obsługą `NULL` — zalecenie: `nullsLast`).
   - Paginacja przez `range(from, to)`.
   - `count: "exact"` do pola `total`.
4. Mapowanie wyników do `GenerationDto[]` (camelCase) i zwrot `200`.

### 6. Względy bezpieczeństwa
- RLS w `public.generations` musi wymuszać owner-only (`user_id = auth.uid()`).
- Walidacja `pageSize` chroni przed masowym odczytem.
- Nie logować tokenu ani pełnych nagłówków.

### 7. Obsługa błędów
- `400`: nieprawidłowe query (np. `pageSize=999`, `sort=foo`).
- `401`: brak lub nieprawidłowy token.
- `500`: błąd Supabase/DB (np. `error` z zapytania), błąd mapowania.

### 8. Wydajność
- Indeksy rekomendowane w DB planie:
  - `idx_generations_user_created_at (user_id, created_at DESC)`
  - `idx_generations_user_status_created_at (user_id, status, created_at DESC)`
- `count: "exact"` bywa kosztowny; jeśli to stanie się wąskim gardłem:
  - rozważyć `count: "estimated"` albo osobny mechanizm/telemetrię (poza MVP).

### 9. Kroki implementacji
1. Dodać walidację query w `src/lib/validation/generations.ts` (lub nowy plik np. `generations.get.ts`), tworząc `generationListQuerySchema`.
2. Dodać metodę serwisową `listGenerations(userId, query)` w `src/lib/services/generationService.ts` (albo wydzielić `GenerationReadService`).
3. W `src/pages/api/generations.ts` dodać `export const GET: APIRoute = ...` korzystający z walidacji + serwisu.
4. Zapewnić spójny format błędów (`400/401/500`) i logowanie.

---

## Endpoint: GET `/generations/{id}`

### 1. Przegląd punktu końcowego
- Cel: pobranie szczegółów pojedynczej generacji wraz z licznikami oraz błędem (jeśli `failed`).

### 2. Szczegóły żądania
- Metoda HTTP: `GET`
- Struktura URL (Astro): `/api/generations/[id]`
- Parametry:
  - **Wymagane**:
    - `id` (UUID w path)
  - **Opcjonalne**: brak
- Body: brak

### 3. Wykorzystywane typy
- `GenerationDetailResponse` (wyjście, zgodne z `GenerationDto`)
- `ErrorResponse` (dla błędów)

### 4. Szczegóły odpowiedzi
- `200 OK`

```json
{
  "id": "uuid",
  "status": "pending|succeeded|failed",
  "createdAt": "ts",
  "finishedAt": "ts|null",
  "generatedCount": 12,
  "acceptedOriginalCount": 5,
  "acceptedEditedCount": 1,
  "error": { "code": "string|null", "message": "string|null" }
}
```

### 5. Przepływ danych
1. Auth: token → user (`401`).
2. Walidacja parametru `id` jako UUID (`400` jeśli nieprawidłowy).
3. Query do `public.generations`:
   - `select(...)` tylko potrzebne kolumny.
   - `eq("id", id)` + `.single()`.
   - RLS spowoduje brak wiersza dla nie-właściciela.
4. Jeśli brak danych → `404`.
5. Mapowanie do `GenerationDto` i `200`.

### 6. Względy bezpieczeństwa
- Zwracać `404` zarówno gdy nie istnieje, jak i gdy nie należy do usera (nie ujawniać istnienia zasobu).
- Nie zwracać `user_id`, `input_*`.

### 7. Obsługa błędów
- `400`: `id` nie jest UUID.
- `401`: brak/invalid token.
- `404`: brak generacji lub brak dostępu (RLS).
- `500`: błąd Supabase/DB.

### 8. Wydajność
- Zapytanie po PK (`id`) jest O(1) przy indeksie PK.
- Nie wykonywać dodatkowych joinów — liczniki są w `generations`.

### 9. Kroki implementacji
1. Utworzyć plik `src/pages/api/generations/[id].ts` z `export const prerender = false` i handlerem `GET`.
2. Dodać `generationIdParamSchema` w `src/lib/validation/generations.ts` (lub dedykowany plik).
3. Dodać metodę serwisową `getGenerationById(userId, id)` (zwraca `null` jeśli brak).
4. Dodać logowanie błędów `500` (event np. `"generations.detail.failed"`).

---

## Endpoint: GET `/generations/quota`

### 1. Przegląd punktu końcowego
- Cel: zwrócenie dziennego limitu generacji i pozostałej liczby, z resetem o północy UTC.
- Wykorzystanie: UI/diagnostyka, blokady po stronie klienta.

### 2. Szczegóły żądania
- Metoda HTTP: `GET`
- Struktura URL (Astro): `/api/generations/quota`
- Parametry:
  - **Wymagane**: brak (poza auth).
  - **Opcjonalne**: brak
- Body: brak

### 3. Wykorzystywane typy
- `GenerationQuotaResponse` / `DailyLimitDto`
- `ErrorResponse`

### 4. Szczegóły odpowiedzi
- `200 OK`

```json
{ "remaining": 3, "limit": 10, "resetsAtUtc": "ts" }
```

### 5. Przepływ danych
1. Auth: token → user (`401`).
2. Odczyt limitu globalnego:
   - Odczytać `app_config` dla `key="daily_generation_limit"`.
   - Uzgodnić format `value`:
     - Rekomendacja zgodnie z DB planem: `{"value": 10}` i czytanie `value.value`.
3. Zliczenie wykorzystania:
   - Klientem userowym (RLS) policzyć `generations` z `status='succeeded'` od `utcStartOfDay(now)` do teraz.
4. Obliczenie:
   - `remaining = max(limit - used, 0)`
   - `resetsAtUtc = nextUtcMidnight(now)` (UTC).
5. Zwrot `200`.

### 6. Względy bezpieczeństwa
- W odpowiedzi nie ujawniać `used` (spec nie wymaga); jeśli potrzebne diagnostycznie, rozważyć osobny endpoint admin lub rozszerzenie spec.

### 7. Obsługa błędów
- `401`: brak/invalid token.
- `500`:
  - błąd odczytu `app_config` (zły format),
  - błąd count w `generations`.

### 8. Wydajność
- Zliczanie dzienne (`count exact head=true`) jest lekkie przy indeksie `(user_id, created_at DESC)` i filtrze `status`.
- Minimalizować liczbę round-tripów:
  - limit i count można pobrać równolegle w serwisie.

### 9. Kroki implementacji
3. Poprawić/ustalić format `app_config.value` dla `daily_generation_limit` i dopasować logikę odczytu w serwisie:
   - jeśli zostaje `{"value": 10}` → zaktualizować `GenerationService.fetchDailyGenerationLimit()` aby czytał `rawValue.value`.
4. Utworzyć plik `src/pages/api/generations/quota.ts` z handlerem `GET`.
5. Dodać logowanie błędów (`event`: `"generations.quota.failed"`).

