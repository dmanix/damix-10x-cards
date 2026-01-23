## API Endpoint Implementation Plan: GET `/flashcards` oraz GET `/flashcards/{id}`

### 1. Przegląd punktu końcowego
- **Cel (GET `/flashcards`)**: zwrócić stronicowaną listę fiszek **zalogowanego użytkownika** z możliwością filtrowania i sortowania.
- **Cel (GET `/flashcards/{id}`)**: zwrócić pojedynczą fiszkę należącą do zalogowanego użytkownika (owner-only).
- **Zakres danych**: tylko rekordy z `public.flashcards` (zaakceptowane fiszki), bez persystowania propozycji.
- **Warstwa techniczna**: Astro API routes w `src/pages/api`, walidacja Zod w `src/lib/validation`, logika w serwisie `src/lib/services/flashcardService.ts`, dostęp do DB przez Supabase (`context.locals.supabase`).

### 2. Szczegóły żądania

#### 2.1 GET `/flashcards`
- **Metoda HTTP**: `GET`
- **URL**: `/flashcards`
- **Uwierzytelnienie**: wymagane (Supabase Auth).
- **Query params**:
  - **Opcjonalne**:
    - `page?: number` (domyślnie `1`, min `1`)
    - `pageSize?: number` (domyślnie `20`, min `1`, max `100`)
    - `sort?: "createdAt" | "updatedAt"` (domyślnie `"createdAt"`)
    - `order?: "desc" | "asc"` (domyślnie `"desc"`)
    - `source?: "ai" | "ai-edited" | "manual"`
    - `search?: string` (trim, min 1; dopasowanie `ILIKE` do `front` lub `back`)
    - `since?: string` (ISO timestamp; filtr „zmienione od”)
- **Request body**: brak.

#### 2.2 GET `/flashcards/{id}`
- **Metoda HTTP**: `GET`
- **URL**: `/flashcards/{id}`
- **Path params**:
  - **Wymagane**: `id: uuid`
- **Uwierzytelnienie**: wymagane (Supabase Auth).
- **Request body**: brak.

### 3. Wykorzystywane typy (DTO i Command/Query modele)

#### 3.1 Istniejące typy (już w kodzie, `src/types.ts`)
- **DTO**:
  - `FlashcardDto`
  - `PaginatedResponse<T>`
- **Query model**:
  - `FlashcardListQuery`
- **Response**:
  - `FlashcardListResponse` (`PaginatedResponse<FlashcardDto>`)
  - `FlashcardGetResponse` (`FlashcardDto`)
- **Wspólne błędy**:
  - `ErrorResponse`

#### 3.2 Typy do dodania (jeśli potrzebne dla spójności kodu)
- **Param DTO (opcjonalne)**:
  - `FlashcardIdParam` – `{ id: string }` (uuid)
- **Precyzyjny model query po walidacji**:
  - `FlashcardListQueryParsed` – `Required<Pick<FlashcardListQuery,"page"|"pageSize"|"sort"|"order">> & Pick<FlashcardListQuery,"source"|"search"|"since">`
    - Uwaga: w praktyce może to być tylko typ wynikowy Zod (`z.infer<typeof flashcardListQuerySchema>`).

### 4. Przepływ danych

#### 4.1 GET `/flashcards` (listowanie)
1. **Handler**: `src/pages/api/flashcards.ts` → dodać `export const GET: APIRoute`.
2. **Pobranie zależności**:
   - `supabase` z `context.locals.supabase` (zgodnie z regułą backend).
   - `userId` z kontekstu uwierzytelnienia (patrz „Bezpieczeństwo” → autentykacja).
3. **Parsowanie query**:
   - Zbudować obiekt wejściowy do walidacji (`page`, `pageSize`, `sort`, `order`, `source`, `search`, `since`) z `new URL(request.url).searchParams`.
4. **Walidacja**:
   - `validateFlashcardListQuery(...)` (Zod safeParse).
   - W przypadku błędu: `400` + `ErrorResponse` (kod np. `"invalid_request"`).
5. **Wywołanie serwisu**:
   - `FlashcardService.listFlashcards(userId, parsedQuery)`.
6. **Mapowanie i odpowiedź**:
   - Serwis zwraca `FlashcardListResponse`:
     - `items: FlashcardDto[]`
     - `page`, `pageSize`
     - `total` (z `count: "exact"`)
   - Zwrócić `200`.
7. **Logowanie**:
   - Sukces: opcjonalnie `logger.info({ event: "flashcards.list.success", userId, ... })` (bez danych wrażliwych).
   - Błąd: `logger.error({ event: "flashcards.list.failed", userId, error, query })`, zwrócić `500`.

#### 4.2 GET `/flashcards/{id}` (detail)
1. **Handler**: `src/pages/api/flashcards/[id].ts` → dodać `export const GET: APIRoute`.
2. **Pobranie zależności**:
   - `supabase` z `context.locals.supabase`
   - `userId` z kontekstu uwierzytelnienia.
3. **Walidacja `id`**:
   - Zod schema `z.object({ id: z.string().uuid() })` lub dedykowana `validateFlashcardIdParam`.
   - Błąd: `400` + `ErrorResponse`.
4. **Wywołanie serwisu**:
   - `FlashcardService.getFlashcardById(userId, id)`.
5. **Odpowiedź**:
   - Jeśli brak rekordu: `404` + `{ code: "not_found", message: "Flashcard not found." }`
   - Jeśli jest: `200` + `FlashcardGetResponse`
6. **Logowanie**:
   - Błąd: `logger.error({ event: "flashcards.detail.failed", userId, id, error })`, zwrócić `500`.

### 5. Względy bezpieczeństwa

#### 5.1 Autentykacja (Supabase Auth)
Specyfikacja wymaga `401` dla braku uwierzytelnienia.
- **Wymóg dla endpointów**:
  - jeśli brak usera → `401` (`{ code: "unauthorized", message: "Authentication required." }`)

#### 5.2 Autoryzacja (owner-only)
- Każde zapytanie do `flashcards` musi być ograniczone do właściciela:
  - **minimum**: `.eq("user_id", userId)`
  - **dodatkowo**: RLS w Postgres/Supabase (polityka `SELECT` dla `authenticated` gdzie `user_id = auth.uid()`).
- Dla GET `/flashcards/{id}` zwracać `404` jeśli rekord nie istnieje **lub** nie jest owned (nie ujawniać istnienia zasobu innych użytkowników).

#### 5.3 Walidacja i odporność na nadużycia
- `pageSize` max 100 (ochrona przed DoS przez duże listy).
- `sort`/`order` tylko z allow-listy (ochrona przed SQL/order injection).
- `search`:
  - trim + minimalna długość, żeby nie wykonywać kosztownych `ILIKE '%%'`.
  - rozważyć ograniczenie maks. długości (np. 200) dla ochrony.
- `since`:
  - walidować jako ISO timestamp; odrzucić nieprawidłowe formaty (400).

### 6. Obsługa błędów

#### 6.1 Scenariusze błędów i statusy
- **401 Unauthorized**
  - brak autentykacji (brak/niepoprawny token, brak sesji).
- **400 Bad Request**
  - niepoprawne parametry query (`page`, `pageSize`, `sort`, `order`, `source`, `since`)
  - `id` nie jest UUID (dla detail)
- **404 Not Found**
  - fiszka nie istnieje lub nie należy do użytkownika (dla detail)
- **500 Internal Server Error**
  - błędy Supabase/DB, nieoczekiwane wyjątki w serwisie

#### 6.2 Kontrakt błędów (spójny z istniejącymi endpointami)
- `ErrorResponse`:
  - `code`: np. `"invalid_request" | "invalid_params" | "unauthorized" | "not_found" | "server_error"`
  - `message`: krótki, user-friendly
  - `details?`: opcjonalnie dla debug (unikać danych wrażliwych)

#### 6.3 Rejestrowanie błędów w tabeli błędów
- W dostarczonych zasobach DB **nie ma tabeli błędów** (np. `error_logs`). Dlatego:
  - **MVP**: logować przez `src/lib/logger.ts` (`logger.error(...)`) z polami `event`, `userId`, `query/id`, `error`.

### 7. Wydajność
- **Pagination**: zawsze używać `.range(from, to)` i `.select(..., { count: "exact" })`.
- **Indexy (zalecane)**:
  - `flashcards (user_id, created_at desc)`
  - `flashcards (user_id, updated_at desc)`
  - `flashcards (user_id, source)`
- **Search (`ILIKE`)**:
  - MVP: `.or("front.ilike.%q%,back.ilike.%q%")` (Supabase `or`).
  - Docelowo (duże wolumeny): `pg_trgm` + indeks trigramowy na `front` i `back`, lub FTS.
- **Since**: filtrować po `updated_at >= since` (najbardziej intuicyjne dla synchronizacji „zmienione od”).

### 8. Kroki implementacji

#### 8.1 Walidacja (Zod)
1. Rozszerzyć `src/lib/validation/flashcards.ts` o:
   - `flashcardListQuerySchema` oraz `validateFlashcardListQuery(payload)` (safeParse).
   - `flashcardIdParamSchema` oraz `validateFlashcardIdParam(payload)` (safeParse) albo użyć lokalnego Zod w endpointzie (preferowane: wspólne util).
2. Proponowane zasady walidacji:
   - `page`: `z.coerce.number().int().min(1).default(1)`
   - `pageSize`: `z.coerce.number().int().min(1).max(100).default(20)`
   - `sort`: `z.enum(["createdAt","updatedAt"]).default("createdAt")`
   - `order`: `z.enum(["desc","asc"]).default("desc")`
   - `source`: `z.enum(["ai","ai-edited","manual"]).optional()`
   - `search`: `z.string().trim().min(1).max(200).optional()`
   - `since`: `z.string().datetime({ offset: true }).or(z.string().datetime()).optional()` (w zależności od oczekiwań; doprecyzować w implementacji)

#### 8.2 Serwis (`FlashcardService`)
3. Dodać metody do `src/lib/services/flashcardService.ts`:
   - `listFlashcards(userId: string, query: FlashcardListQueryParsed): Promise<FlashcardListResponse>`
   - `getFlashcardById(userId: string, id: string): Promise<FlashcardDto | null>`
4. Implementacja `listFlashcards` (szczegóły zapytań):
   - `from = (page - 1) * pageSize`, `to = from + pageSize - 1`
   - Query bazowe:
     - `.from("flashcards")`
     - `.select("id, front, back, source, generation_id, created_at, updated_at", { count: "exact" })`
     - `.eq("user_id", userId)`
   - Filtry:
     - `source` → `.eq("source", source)`
     - `search` → `.or(\`front.ilike.%${q}%,back.ilike.%${q}%\`)`
     - `since` → `.gte("updated_at", since)`
   - Sort:
     - `sort === "updatedAt" ? "updated_at" : "created_at"`
     - `.order(column, { ascending: order === "asc" })`
   - Range:
     - `.range(from, to)`
   - Mapowanie:
     - `generation_id` → `generationId`
     - `created_at/updated_at` → `createdAt/updatedAt`
5. Implementacja `getFlashcardById`:
   - `.from("flashcards").select("id, front, back, source, generation_id, created_at, updated_at")`
   - `.eq("id", id).eq("user_id", userId).maybeSingle()`
   - Zwrócić `null` jeśli brak.

#### 8.3 Endpointy (Astro API routes)
6. `src/pages/api/flashcards.ts`:
   - dodać `GET` obok istniejącego `POST`
   - spójny `jsonResponse(status, body)`
   - pobrać `supabase` z `locals`
   - pobrać `userId` z auth (docelowo);
   - walidować query przez `validateFlashcardListQuery`
   - wywołać `FlashcardService.listFlashcards`
7. `src/pages/api/flashcards/[id].ts`:
   - dodać `GET` obok istniejącego `PUT`
   - walidować `params.id`
   - pobrać `userId` z auth
   - wywołać `FlashcardService.getFlashcardById`
   - `404` jeśli brak

#### 8.4 Logowanie i obserwowalność
8. Dodać eventy:
   - `flashcards.list.failed`
   - `flashcards.detail.failed`
   - (opcjonalnie) `flashcards.list.success`, `flashcards.detail.success`
9. Logi nie mogą zawierać:
   - tokenów, cookies, pełnych treści fiszek (wystarczy `id`, `page/pageSize`, flagi filtrów).

