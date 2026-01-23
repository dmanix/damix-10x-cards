# Schemat bazy danych (PostgreSQL / Supabase) — Damix 10x Cards (MVP)

## 1. Lista tabel z ich kolumnami, typami danych i ograniczeniami

> **Założenia MVP (z notatek i PRD):**
> - Uwierzytelnianie przez Supabase Auth (`auth.users`) — **bez** dodatkowej tabeli `profiles`.
> - Jedna globalna kolekcja fiszek per użytkownik (brak talii / decków).
> - Propozycje wygenerowanych fiszek **nie są persystowane**; zapisujemy tylko zaakceptowane fiszki w `flashcards`.
> - Limity generowania liczone po tabeli `generations` (UTC day), a globalny limit jest w `app_config`.

### 1.1 `public.flashcards`

Tabela przechowująca **zaakceptowane** fiszki użytkownika (AI i manual).

- **id**: `uuid` **PK**, `NOT NULL`, `DEFAULT gen_random_uuid()`
- **user_id**: `uuid` `NOT NULL`
  - **FK** → `auth.users(id)` `ON DELETE CASCADE`
- **front**: `text` `NOT NULL`
  - `CHECK (char_length(front) <= 200)`
  - `CHECK (char_length(front) >= 1)`
- **back**: `text` `NOT NULL`
  - `CHECK (char_length(back) <= 500)`
  - `CHECK (char_length(back) >= 1)`
- **source**: `text` `NOT NULL`
  - `CHECK (source IN ('ai', 'ai-edited', 'manual'))`
- **generation_id**: `uuid` `NULL`
  - **FK** → `public.generations(id)` `ON DELETE RESTRICT`
  - **UWAGA**: pole wymagane dla fiszek AI, a `NULL` dla manualnych (patrz constraint poniżej)
- **created_at**: `timestamptz` `NOT NULL` `DEFAULT now()`
- **updated_at**: `timestamptz` `NOT NULL` `DEFAULT now()`

**Dodatkowe ograniczenia:**
- Spójność `source` ↔ `generation_id`:
  - `CHECK ( (source = 'manual' AND generation_id IS NULL) OR (source IN ('ai', 'ai-edited') AND generation_id IS NOT NULL) )`

---

### 1.2 `public.generations`

Tabela zdarzeń/prob generowania (limit dzienny, diagnostyka, liczniki metryk sukcesu).

- **id**: `uuid` **PK**, `NOT NULL`, `DEFAULT gen_random_uuid()`
- **user_id**: `uuid` `NOT NULL`
  - **FK** → `auth.users(id)` `ON DELETE CASCADE`
- **status**: `text` `NOT NULL` `DEFAULT 'pending'`
  - `CHECK (status IN ('pending', 'succeeded', 'failed'))`
- **created_at**: `timestamptz` `NOT NULL` `DEFAULT now()`
- **finished_at**: `timestamptz` `NULL`
- **error_code**: `text` `NULL`
- **error_message**: `text` `NULL`
- **input_length**: `integer` `NOT NULL`
  - `CHECK (input_length BETWEEN 1000 AND 20000)`
- **input_hash**: `bytea` `NOT NULL`
  - Rekomendacja: SHA-256 znormalizowanego inputu
  - `CHECK (octet_length(input_hash) = 32)`
- **generated_count**: `integer` `NULL`
- **accepted_original_count**: `integer` `NULL`
- **accepted_edited_count**: `integer` `NULL`

**Uwagi dot. limitu dziennego:**
- Do limitu dziennego wliczają się tylko rekordy z `status = 'succeeded'`.
- Okno dobowej agregacji: **UTC**.

---

### 1.3 `public.app_config`

Tabela klucz-wartość na globalne ustawienia aplikacji (np. dzienny limit generowania).

- **key**: `text` **PK**, `NOT NULL`
- **value**: `jsonb` `NOT NULL`
- **updated_at**: `timestamptz` `NOT NULL` `DEFAULT now()`

**Rekomendowane klucze (MVP):**
- `daily_generation_limit`: `{"value": 10}` (lub inna liczba)

**Bezpieczeństwo:**
- Tabela dostępna do odczytu dla wszystkich użytkowników (RLS z polityką SELECT dla `anon` i `authenticated`).

---

## 2. Relacje między tabelami

- **`auth.users (1) -> (N) public.flashcards`**
  - Kardynalność: jeden użytkownik ma wiele fiszek
  - Łączenie: `flashcards.user_id -> auth.users.id`
- **`auth.users (1) -> (N) public.generations`**
  - Kardynalność: jeden użytkownik ma wiele prób generowania
  - Łączenie: `generations.user_id -> auth.users.id`
- **`public.generations (1) -> (N) public.flashcards`** *(tylko dla fiszek AI)*
  - Kardynalność: jedna generacja może skutkować wieloma zaakceptowanymi fiszkami
  - Łączenie: `flashcards.generation_id -> generations.id`
  - Ograniczenie: `flashcards.source` determinuje obowiązkowość `generation_id`
- **`public.app_config`**
  - Brak relacji FK (globalne ustawienia)

Nie występują relacje wiele-do-wielu w MVP (brak tabel łączących).

---

## 3. Indeksy

### 3.1 `public.flashcards`

- **`idx_flashcards_user_created_at`**: `(user_id, created_at DESC)`
  - Uzasadnienie: szybka lista fiszek użytkownika (najczęstszy widok).
- **`idx_flashcards_user_updated_at`**: `(user_id, updated_at DESC)`
  - Uzasadnienie: sortowanie po ostatnich zmianach (edycja kolekcji).
- **`idx_flashcards_user_source`**: `(user_id, source)`
  - Uzasadnienie: agregacje/metyki typu AI vs manual.
- **(opcjonalnie)** `idx_flashcards_generation_id`: `(generation_id)`
  - Uzasadnienie: szybkie zliczenia/joiny po generacji.

### 3.2 `public.generations`

- **`idx_generations_user_created_at`**: `(user_id, created_at DESC)`
  - Uzasadnienie: liczenie dziennego wykorzystania limitu i historia generacji.
- **`idx_generations_user_status_created_at`**: `(user_id, status, created_at DESC)`
  - Uzasadnienie: filtrowanie po statusie i czasie.

### 3.3 `public.app_config`

- PK na `key` wystarcza dla MVP.

---

## 4. Zasady PostgreSQL (RLS) — Supabase

> Cel: **owner-only** na tabelach per-user (`flashcards`, `generations`).

### 4.1 `public.flashcards` — RLS

- **RLS**: `ENABLE ROW LEVEL SECURITY`
- **Polityki** (dla roli `authenticated`):
  - **SELECT**: `USING (user_id = auth.uid())`
  - **INSERT**: `WITH CHECK (user_id = auth.uid())`
  - **UPDATE**:
    - `USING (user_id = auth.uid())`
    - `WITH CHECK (user_id = auth.uid())` *(blokuje zmianę `user_id`)*
  - **DELETE**: `USING (user_id = auth.uid())`

### 4.2 `public.generations` — RLS

- **RLS**: `ENABLE ROW LEVEL SECURITY`
- **Polityki** (dla roli `authenticated`):
  - **SELECT**: `USING (user_id = auth.uid())`
  - **INSERT**: `WITH CHECK (user_id = auth.uid())`
  - **UPDATE**:
    - `USING (user_id = auth.uid())`
    - `WITH CHECK (user_id = auth.uid())`
  - **DELETE**: `USING (user_id = auth.uid())`

### 4.3 `public.app_config` — RLS

- **RLS**: `ENABLE ROW LEVEL SECURITY`
- **Polityki**:
  - **SELECT** dla `anon` i `authenticated` (odczyt dozwolony dla wszystkich).
  - **INSERT/UPDATE/DELETE** tylko dla backendu (np. role admin/service role).

---

## 5. Dodatkowe uwagi / decyzje projektowe

- **Normalizacja**: model spełnia potrzeby MVP bez denormalizacji; liczniki metryk trzymamy w `generations` (stan bieżący), zgodnie z notatkami.
- **Brak przechowywania tekstu wejściowego**: w `generations` zapisujemy tylko `input_length` i `input_hash` (minimalizacja danych wrażliwych).
- **Walidacje jakości fiszek**: poza DB (DB ogranicza tylko deterministyczne długości `front/back`).
- **Race condition limitu**: w MVP dopuszczony (brak atomowej rezerwacji limitu) — logika limitu oparta o `generations` + czas UTC.
- **Retencja**: `generations` przechowywane bezterminowo (brak cleanup w MVP).
- **Usuwanie fiszek**: twarde (DELETE), zgodnie z notatkami.
- **`updated_at`**: rekomendacja dodania triggera aktualizującego `updated_at` przy `UPDATE` (ułatwia sortowanie i audyt), ale nie jest to twardy wymóg schematu.


