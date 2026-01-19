# API Endpoint Implementation Plan: POST /generations

## 1. Przegląd punktu końcowego
Synchroniczne rozpoczęcie generowania dla uwierzytelnionego użytkownika. Akceptuje wejście tekstowe (1k–20k znaków), wymusza dzienny limit per użytkownik (UTC) z `app_config.daily_generation_limit`, zapisuje wpis w `public.generations`, wywołuje dostawcę AI w celu wygenerowania propozycji (nie są zapisywane), i zwraca metadane generowania wraz z propozycjami i pozostałym limitem.

## 2. Szczegóły żądania
- Metoda HTTP: POST
- Struktura URL: `/generations`
- Parametry:
  - Wymagane: uwierzytelniony użytkownik Supabase (session in `context.locals.supabase`)
  - Opcjonalne: brak query params
- Nagłówki: `Content-Type: application/json`
- Request Body: `{ "text": string }`
- Walidacja:
  - `text` wymagany, string, trimming + normalizacja białych znaków.
  - Długość po normalizacji: `1000 <= len <= 20000`; w przeciwnym razie 400.
  - Wspólne z DB constraint: `input_length` musi mieścić się w tym zakresie.

## 3. Wykorzystywane typy
- `GenerationCreateCommand` (src/types.ts) – input contract `{ text: string }`.
- `GenerationStartResponse` (src/types.ts) – shape sukcesu 201.
- `ProposalDto` (src/types.ts) – elementy `proposals`.
- `DailyLimitDto` (src/types.ts) – limit/pozostało/resetAtUtc.
- `GenerationStatus`, `GenerationDto` – statusy, logowanie w tabeli.
- Nowe (service-level, jeśli potrzebne): `NormalizedInput` (text, length, hash), `GenerationRecord` (DB insert/update payload).

## 4. Szczegóły odpowiedzi
- 201 Created (sukces):
  - Body: `{ generation: { id, status: "succeeded", createdAt }, proposals: ProposalDto[], dailyLimit: DailyLimitDto }`
- 422 Unprocessable Entity (wykryta niska jakość): `{ code: "low_quality_input", message, remaining }`
- 403 Forbidden (limit wyczerpany): `{ code: "daily_limit_exceeded", message, remaining, limit, resetsAtUtc }`
- 400 Bad Request (walidacja długości / schema): `{ code: "invalid_request", message }`
- 401 Unauthorized (brak sesji)
- 500 Internal Server Error (provider/nieoczekiwany błąd): `{ code: "provider_error" | "internal_error", message }`; generacja zapisana z `status='failed'`, `error_code`, `error_message`.

## 5. Przepływ danych
1) Auth: pobierz user_id z Supabase session (`context.locals.supabase.auth.getUser()`); brak → 401.  
2) Parse + zod-validate body do `GenerationCreateCommand`.  
3) Normalizuj tekst (trim, collapse whitespace where appropriate), policz długość; jeśli poza 1k–20k → 400.  
4) Pobierz `daily_generation_limit` z `app_config` (service role) i policz dzisiejsze (UTC) udane generacje użytkownika (`status='succeeded'`, `created_at` w bieżącym dniu UTC). Wylicz remaining i `resetsAtUtc` (początek następnej doby UTC). Jeśli remaining ≤ 0 → 403.  
5) Oblicz `input_hash` (SHA-256 po normalizacji, bytea 32) i `input_length`.  
6) Utwórz wiersz w `generations` ze `status='pending'`, `input_length`, `input_hash`, `user_id`, `created_at` default.   
7) Wywołaj provider (OpenRouter/OpenAI) w service (np. `src/lib/services/generationService`), uzyskaj propozycje fiszek (front/back). 
8) Jeśli provider zwróci informację, że tekst jest niskiej jakości: zaktualizuj wiersz `status='failed'`, `error_code='low_quality_input'`, `error_message`, `finished_at=now()`; zwróć 422 z remaining (nie zmniejszamy limitu, bo status failed). 
9) Jeśli provider zwrócił propozycje fiszek: Ustaw `generated_count = proposals.length`, `accepted_original_count = null`, `accepted_edited_count = null` (brak akceptacji na tym etapie).  
10) Zaktualizuj wiersz `status='succeeded'`, `finished_at=now()`, zapisując `generated_count`.  
11) Zwróć 201 z `generation` (id, status, createdAt), `proposals`, `dailyLimit` (remaining-1, limit, resetsAtUtc).  
12) Logowanie błędów provider/internal: `error_code` (np. provider code), `error_message` (skrócony komunikat), `status='failed'`, `finished_at` i 500 response.

## 6. Względy bezpieczeństwa
- Autoryzacja: tylko zalogowani; używaj `context.locals.supabase` zamiast globalnego klienta.  
- RLS: `generations` powinno mieć RLS na user_id; operacje insert/update wykonywane service role w API route, ale zawsze z filtrem user_id.  
- Walidacja inputu z zod; limit długości zapobiega nadużyciom i ogromnym promptom.  
- Hash wejścia w DB, brak zapisywania pełnego tekstu (tylko długość + hash) aby ograniczyć ekspozycję danych.  
- Rate limiting: główny mechanizm to dzienny limit; 
- Sanitacja odpowiedzi providerów (trim strings) aby uniknąć wstrzyknięć HTML; front powinien encodować output.  
- Unikaj logowania pełnych tekstów do stdout; loguj tylko hash i metadane.

## 7. Obsługa błędów
- Walidacja schema/length → 400.  
- Brak auth → 401.  
- Limit przekroczony → 403 (bez tworzenia nowego wiersza w `generations`).  
- Low quality → 422 (wiersz istnieje, status failed).  
- Provider timeout/HTTP error → 500 + update row to failed.  
- Nieoczekiwany błąd → 500 + failed row + ogólny komunikat.  
- Wszystkie ścieżki failure aktualizują `finished_at`, `error_code`, `error_message`.

## 8. Rozważania dotyczące wydajności
- Pojedynczy insert/update na `generations`; brak persystencji `proposals` zmniejsza I/O.  
- Cache `daily_generation_limit` w pamięci procesu z krótkim TTL (np. 60s) aby ograniczyć odczyty `app_config`.  
- Liczenie dziennych sukcesów: użyj indeksu po `(user_id, status, created_at)` lub widoku/materialized view jeśli potrzebne; w kodzie filtr po `created_at >= date_trunc('day', now() AT TIME ZONE 'utc')`.  
- Ogranicz długość promptu do 20k, ustaw timeout na wywołanie providera na 60 sekund.  
- Strumieniowanie nie jest potrzebne (synchronizacja), ale można dodać w przyszłości.

## 9. Etapy wdrożenia
1) Utworzenie pliku endpointu w `src/pages/api/generations.ts`
2) Utwórz zod schema dla requestu w `src/lib/validation/generations.ts` (text required, length guard).  
3) Dodaj service `src/lib/services/generationService.ts`
  - Pobieranie limitu, liczenie zużyć, hash, insert/update helpers
  - Provider call, na tym etapie developmentu skorzystamy z mocków zamiast wywoływania serwisu AI.
4) Implementuj endpoint w `src/pages/api/generations.ts`: auth, walidacja, limit check, insert pending, quality gate, provider call, finalize status, map responses/kody.
5) Dodaj helper do obliczenia `resetsAtUtc` (początek kolejnej doby UTC) w wspólnym utilu (`src/lib/dates.ts`).   


