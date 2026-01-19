# API Endpoint Implementation Plan: POST /flashcards

## 1. Przegląd punktu końcowego
Endpoint tworzy jedną lub wiele fiszek dla zalogowanego użytkownika. Obsługuje fiszki manualne (`source="manual"` i `generationId=null`) oraz AI (`source="ai"|"ai-edited"` z wymaganym `generationId`). Dla fiszek AI aktualizuje liczniki akceptacji w `public.generations` (pola `accepted_original_count`, `accepted_edited_count`).

## 2. Szczegóły żądania
- Metoda HTTP: POST
- Struktura URL: `/flashcards`
- Parametry:
  - Wymagane: uwierzytelniony użytkownik Supabase (session w `context.locals.supabase`)
  - Opcjonalne: brak query params
- Nagłówki: `Content-Type: application/json`
- Request Body:
  - `{ "flashcards": [ { "front": string, "back": string, "source": "manual"|"ai"|"ai-edited", "generationId"?: uuid|null } ] }`
- Walidacja:
  - `flashcards` wymagane, tablica min 1.
  - `front` wymagany, string, `1..200` znaków.
  - `back` wymagany, string, `1..500` znaków.
  - `source` wymagany, tylko `manual|ai|ai-edited`.
  - Spójność `source` ↔ `generationId`:
    - `manual` → `generationId` musi być `null` lub brak w payloadzie.
    - `ai|ai-edited` → `generationId` wymagany i typu UUID.
  - Zbieżność z constraintami DB w `flashcards`.

## 3. Wykorzystywane typy
- `CreateFlashcardsCommand` (src/types.ts) – request body.
- `CreateFlashcardsResponse` (src/types.ts) – response 201.
- `FlashcardDto`, `FlashcardSource` (src/types.ts) – elementy odpowiedzi i walidacji.
- Service-level (nowe):
  - `CreateFlashcardsInput` – znormalizowana lista fiszek do inserta.
  - `GenerationAcceptCounts` – mapowanie `generationId -> { originalDelta, editedDelta }`.

## 4. Szczegóły odpowiedzi
- 201 Created (sukces):
  - Body: `{ "created": [ { "id", "front", "back", "source", "generationId" } ] }`
- 400 Bad Request:
  - `invalid_request` (schema, długości, invalid source, mismatch generationId).
- 401 Unauthorized:
  - brak sesji.
- 403 Forbidden:
  - `generation_ownership_mismatch` – `generationId` nie należy do użytkownika.
- 500 Internal Server Error:
  - nieoczekiwany błąd zapisu lub aktualizacji liczników.

## 5. Przepływ danych
1) Auth: `context.locals.supabase.auth.getUser()`; brak → 401.  
2) Parse + zod-validate body do `CreateFlashcardsCommand`.  
3) Znormalizuj payload (trim `front/back`, usuń puste stringi po trimie → 400).  
4) Zbuduj listę AI `generationId` i sprawdź własność:  
   - `select id from generations where id in (...) and user_id = currentUser`  
   - jeśli jakikolwiek brak → 403.  
5) Wylicz delty akceptacji per `generationId`:
   - `source="ai"` → `accepted_original_count += 1`
   - `source="ai-edited"` → `accepted_edited_count += 1`
6) Persist:
   - Insert do `flashcards` (`user_id` z sesji, `generation_id` mapowany z `generationId`).
   - Update `generations` dla zebranych `generationId`:
     - `accepted_original_count = coalesce(accepted_original_count,0) + delta`
     - `accepted_edited_count = coalesce(accepted_edited_count,0) + delta`
   - Wywołanie bez RPC: najpierw insert, potem update; w razie błędu logować i zwracać 500 (ryzyko częściowego zapisu).
7) Mapuj wynik do `CreateFlashcardsResponse` i zwróć 201.

## 6. Względy bezpieczeństwa
- Autoryzacja: tylko zalogowani użytkownicy, `context.locals.supabase`.  
- RLS na `flashcards` i `generations` po `user_id`; każde zapytanie filtrowane po user.  
- Walidacja Zod w API route; brak tolerancji dla pól spoza schematu.  
- Ochrona przed nadużyciami: limit długości `front/back`.  
- Nie loguj pełnych treści fiszek; loguj tylko identyfikatory i liczności.

## 7. Obsługa błędów
- 400: `flashcards` puste, invalid `source`, brak/wadliwy `generationId`, długości poza limitem.  
- 401: brak sesji.  
- 403: `generationId` nie należy do użytkownika.  
- 500: błąd inserta/aktualizacji; log `error.message` + traceId.  
- Brak tabeli błędów dla tego endpointu; logowanie w `console.error`/observability.

## 8. Rozważania dotyczące wydajności
- Batch insert: użyj `insert([...])` dla wielu fiszek.  
- Sprawdzanie własności `generationId` w jednym zapytaniu (`in`).  
- Aktualizacja liczników w jednym statement per `generationId`.  

## 9. Kroki implementacji
1) Utwórz zod schema w `src/lib/validation/flashcards.ts` dla `CreateFlashcardsCommand`.  
2) Dodaj serwis `src/lib/services/flashcardService.ts`:
   - `validateGenerationOwnership(userId, generationIds)`  
   - `buildAcceptCounts(flashcards)`  
   - `createFlashcards(userId, flashcards)` (insert + update counts)  
3) Implementuj endpoint w `src/pages/api/flashcards.ts`:
   - `export const prerender = false`, `export async function POST(...)`  
   - auth guard, parse/validate, service call, map response, error handling  
6) Sprawdź lint i typy (`read_lints`) po implementacji.

