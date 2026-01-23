# API Endpoint Implementation Plan: DELETE /flashcards/{id}

## 1. Przegląd punktu końcowego
Endpoint usuwa jedną fiszkę należącą do aktualnie zalogowanego użytkownika. Operacja jest nieodwracalna (hard delete) i zwraca `204 No Content` po powodzeniu. Dla brakującej lub nieposiadanej fiszki zwraca `404`.

## 2. Szczegóły żądania
- Metoda HTTP: `DELETE`
- Struktura URL: `/flashcards/{id}`
- Parametry:
  - Wymagane: `id` (UUID) w ścieżce
  - Opcjonalne: brak
- Request Body: brak

## 3. Wykorzystywane typy
- DTO:
  - `DeleteFlashcardResponse` (alias `void`) z `src/types.ts`
  - `ErrorResponse` z `src/types.ts`
- Command modele:
  - brak nowego commandu; wystarczy `id` z parametru ścieżki

## 3. Szczegóły odpowiedzi
- `204 No Content` — pomyślne usunięcie
- `400 Bad Request` — nieprawidłowy `id` (nie-UUID)
- `401 Unauthorized` — brak uwierzytelnienia (brak klienta Supabase w `locals`)
- `404 Not Found` — fiszka nie istnieje lub nie należy do użytkownika
- `500 Internal Server Error` — błąd po stronie serwera

## 4. Przepływ danych
1. `src/pages/api/flashcards/[id].ts` przyjmuje żądanie `DELETE`.
2. Pobranie klienta `supabase` z `context.locals` (zgodnie z regułami backend).
3. Walidacja parametru `id` przez `validateFlashcardIdParam` (Zod).
4. Wywołanie `FlashcardService.deleteFlashcard(userId, id)`:
   - `DELETE FROM flashcards WHERE id = ? AND user_id = ?` (Supabase).
   - Jeśli `row` nie istnieje → `FlashcardNotFoundError`.
   - Dla `source` = `ai` / `ai-edited` i `generation_id` ≠ NULL: zaktualizuj liczniki w `generations` (dekrement odpowiednich pól).
5. Zwrócenie `204` bez body.
6. Logowanie błędów przez `logger` przy wyjątkach nieoczekiwanych.

## 5. Względy bezpieczeństwa
- Wymagany klient `supabase` z `locals` (sesja użytkownika).
- Autoryzacja poprzez warunek `user_id = currentUserId` w zapytaniu.
- RLS w Supabase traktować jako drugą linię obrony (polityki dla `flashcards`).
- Brak body ogranicza powierzchnię ataku; walidować tylko parametr `id`.

## 6. Obsługa błędów
- `400`:
  - `id` nie jest poprawnym UUID.
- `401`:
  - Brak klienta Supabase w `locals` lub brak sesji użytkownika.
- `404`:
  - Fiszka nie istnieje lub nie należy do użytkownika.
- `500`:
  - Błąd komunikacji z Supabase.
  - Nieoczekiwany błąd w serwisie (np. brak zwróconych danych po delete).

## 7. Rozważania dotyczące wydajności
- Operacja usuwa pojedynczy rekord po kluczu głównym + filtr `user_id` (indeksy PK i FK).
- Dodatkowa aktualizacja `generations` tylko dla AI/AI-edited; pojedyncze zapytanie `UPDATE` po `id`.
- Brak potrzeby paginacji, brak odpowiedzi z payloadem.

## 8. Etapy wdrożenia
1. **Walidacja parametru**: użyć `validateFlashcardIdParam` w `src/pages/api/flashcards/[id].ts` dla `DELETE`.
2. **Serwis**: dodać metodę `deleteFlashcard` do `FlashcardService` w `src/lib/services/flashcardService.ts`.
   - Pobranie rekordu (`select`) w celu sprawdzenia `source` i `generation_id`.
   - `delete().eq("id", id).eq("user_id", userId)`.
   - Jeśli brak rekordu → `FlashcardNotFoundError`.
   - Jeśli `source` = `ai` → dekrement `accepted_original_count`.
   - Jeśli `source` = `ai-edited` → dekrement `accepted_edited_count`.
   - Zabezpieczyć przed wartościami < 0 (użyć `Math.max`).
3. **Endpoint**: dodać obsługę `DELETE` w `src/pages/api/flashcards/[id].ts`.
   - `400` przy złym `id`.
   - `401` gdy brak `supabase`.
   - `404` dla `FlashcardNotFoundError`.
   - `204` przy sukcesie.
4. **Logowanie**: użyć `logger.error` z kontekstem (`userId`, `flashcardId`, `event`).
5. **Testy ręczne**:
   - Usuń istniejącą fiszkę użytkownika → `204`.
   - Usuń nieistniejącą → `404`.
   - Niepoprawny UUID → `400`.
   - Sprawdź aktualizację liczników w `generations` dla AI/AI-edited.
