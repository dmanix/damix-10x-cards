# API Endpoint Implementation Plan: PUT /flashcards/{id}

## 1. Przegląd punktu końcowego
- Cel: umożliwić właścicielowi fiszki zastąpienie treści przedniej/tylnej, zachowując przypisanie do generacji AI i dostosowując źródło oraz liczniki w tabeli `generations` w przypadku edycji AI.
- Kontekst technologiczny: Astro API route (`src/pages/api/flashcards/[id].ts`) z autoryzacją Supabase, logiczną warstwą w `src/lib/services/flashcardService.ts` i pomocniczym loggerem `src/lib/logger.ts`.
- Wynik: zwrócenie zaktualizowanego identyfikatora + źródła + ścieżki czasowej (zgodnie z `UpdateFlashcardResponse`) z kodem 200.

## 2. Szczegóły żądania
- Metoda HTTP: `PUT`
- Struktura URL: `/flashcards/{id}` (uuid fiszki w ścieżce)
- Parametry:
  - **Wymagane**: `id` (UUID, path param); ważna sesja uwierzytelniona Supabase w `context.locals`.
  - **Opcjonalne**: `front` (string z min 1, max 200 znaków), `back` (string z min 1, max 500 znaków). Przynajmniej jedno pole musi być obecne.
- Request Body: JSON `{ "front"?: string, "back"?: string }` (obydwie wartości nie są puste, prawidłowa długość). Walidacja z Zod: `z.object({ front: z.string().min(1).max(200).optional(), back: z.string().min(1).max(500).optional() }).refine(data => data.front ?? data.back, { message: "front or back must be provided" })`.
- Wykorzystywane typy: `UpdateFlashcardCommand` (partial `front`/`back`), `FlashcardDto`, `FlashcardSource`, `UpdateFlashcardResponse`.

## 3. Szczegóły odpowiedzi
- 200 OK: `{ "id": uuid, "source": "manual" | "ai" | "ai-edited", "updatedAt": "ts" }` (mapowane z `flashcards.updated_at`, `FlashcardSource`, identyfikator).
- 400 Bad Request: schema Zod nie przechodzi, brak zmian, `front`/`back` poza limitami.
- 401 Unauthorized: brak sesji w `context.locals.session`.
- 404 Not Found: fiszka nie istnieje lub nie należy do użytkownika.
- 500 Internal Server Error: nieprzewidziane błędy Supabase lub logiki.
- Typ zwracany: `UpdateFlashcardResponse` (z `src/types.ts`), dodatkowo `source` może przejść z `ai` → `ai-edited` po edycji.

## 4. Przepływ danych
1. Zainicjuj handler Astro (`export const PUT`) w `src/pages/api/flashcards/[id].ts`, ustaw `prerender = false` i pobierz `supabase` + `session` z `context.locals`.
2. Waliduj `id` (uuid) z `params`, request body za pomocą Zod i sprawdź obecność przynajmniej jednego pola.
3. W przypadku braku sesji zwróć 401 z `ErrorResponse`.
4. Wczytaj fiszkę przez `supabase.from("flashcards").select("id, front, back, source, generation_id").eq("id", id).eq("user_id", userId).maybeSingle()` aby upewnić się o autoryzacji; jeśli brak → 404.
5. Porównaj nowe wartości `front`/`back` z aktualnymi; jeśli nie ma zmian, zwróć 400 sygnalizując brak aktualizacji.
6. Przygotuj payload update: `front/back` (jeśli dostarczone), `source`:
   - Jeśli `source === "ai"` i zmiana treści, ustaw `source = "ai-edited"`.
   - Jeśli już `ai-edited` lub `manual`, zachowaj aktualną wartość.
   - `generation_id` pozostaje bez zmian (lub `null` dla manualnych).
7. Zaktualizuj rekord w `flashcards`, ustawiając `updated_at = new Date().toISOString()` oraz pola `front/back` i `source`.
8. Jeżeli źródło było AI i przechodzi w `ai-edited`, uruchom update liczb w `generations`: zmniejsz `accepted_original_count` o 1 i zwiększ `accepted_edited_count` o 1 dla odpowiadającej generacji (nie schodź poniżej zera, pobierz aktualne wartości przed aktualizacją). Użyj tej samej usługi `FlashcardService` lub rozszerz ją o helper `markGenerationEdited(generationId)` aby nie łamać ograniczeń RLS.
9. Zastosuj `logger.error` w przypadku błędów Supabase (np. `error.message`) i opcjonalnie wstaw log do tabeli błędów (jeśli istnieje `public.error_logs`) zawierający `user_id`, `endpoint`, `payload`, `error`.
10. Odpowiedz w 200 z `UpdateFlashcardResponse` zawierając `id`, `source`, `updatedAt`.

## 5. Względy bezpieczeństwa
- Autoryzacja Supabase: tylko zalogowany użytkownik (`context.locals.session.user.id`) może edytować własne fiszki (filtrowanie `user_id` w zapytaniach i ewentualna polityka RLS w tabeli `flashcards`/`generations`).
- Walidacja wejścia (Zod) chroni przed injection/pustymi stringami i nadmiarowymi danymi; nie przekazuj innych pól.
- Kontrola zakresów: `front` max 200, `back` max 500, char_length w bazie to enforce.
- Ogranicz logowanie wrażliwych danych (np. nie loguj `session.access_token`). Używaj `logger.error` z opisem błędu i ograniczonym payloadem (np. tylko `id`, `userId`, `source`).
- Walidacja UUID `id` -> minimalizuje wstrzyknięcia w `eq`.

## 6. Obsługa błędów
- **400**: brak pól w body lub wartości poza limitem; `refine` w Zod wykrywa; `logger.warn` z powodem.
- **400**: brak zmian treści (poprzednie i nowe wartości identyczne) – unikamy niepotrzebnych zapytań.
- **401**: brak sesji – zwróć `ErrorResponse` ze wskazaniem `code: "unauthorized"`.
- **404**: nie znaleziono fiszki lub nie należy do użytkownika (duplicate to `maybeSingle` bez danych); nie ujawniaj, czy id istnieje pod innym userem.
- **409** (opcjonalnie): race condition jeśli `generation` nie ma wystarczającego `accepted_original_count` – zamiast 409 można użyć 500 i logowania.
- **500**: Supabase error podczas aktualizacji `flashcards`/`generations` – loguj wyjątek i zwróć `ErrorResponse`.
- W przypadku powtarzalnych błędów zapisz je w logu `public.error_logs` (jeśli istnieje) oraz `logger.error`.

## 7. Wydajność
- Minimalna liczba zapytań: 1) `select` fiszki, 2) `update` fiszki, 3) potencjalne `update` generacji (tylko jeśli AI → ai-edited). Dzięki \`maybeSingle()\` w Select otrzymujemy tylko jeden rekord.
- Upewnij się, że tabela `flashcards` ma indeks na `(id, user_id)` (lub przynajmniej `user_id`) w ramach RLS, by szybciej weryfikować właściciela.
- Aktualizacja liczników `generations` powinna używać `eq("id", generationId).eq("user_id", userId)` i w miarę możliwości `supabase.rpc`/`from().update()` w transakcji, by ograniczyć czas.
- Zminimalizuj payload odpowiedzi do wymaganych pól (wg `UpdateFlashcardResponse`).
- Rozważ caching `generation` counts tylko wewnętrznie w handlerze, nie wprowadzaj długotrwałych blokad.

## 8. Kroki implementacji
1. Dodaj nowy plik `src/pages/api/flashcards/[id].ts` z handlerem `export const PUT`, `prerender = false` i importami: `z` (Zod), `FlashcardService`, `createLogger`, `context.locals.supabase`, `context.locals.session`.
2. Stwórz lub rozszerz `FlashcardService` o metodę `updateFlashcard(userId, id, command)` i helper `markAsEditedIfAi(flashcard, command)` do obliczania `source` oraz `shouldAdjustGenerationCounts`.
3. W handlerze:
   - Waliduj `params.id` jako UUID.
   - Weryfikuj `session`.
   - Parsuj body (Zod) i łącz `UpdateFlashcardCommand`.
   - Pobieraj fiszkę, sprawdzaj właściciela.
   - Oblicz zmiany (porównaj stare/nowe wartości).
   - Przygotuj dane update i zaktualizuj `flashcards`.
   - Jeżeli potrzeba, wywołaj dodatkowy helper do zmiany `generations`.
4. Upewnij się, że aktualizacja generacji obsługuje `accepted_original_count` >= 1 przed dekrementacją i zapisuje `accepted_edited_count`.
5. Obsłuż błędy Supabase: `if (error) { logger.error(...); return new Response(ErrorResponse,..., { status: 500 }); }`.
