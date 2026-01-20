# Architektura UI dla Damix 10x Cards

## 1. Przegląd struktury UI

Damix 10x Cards to aplikacja webowa, której UI jest podzielony na:

- **Strefę publiczną (bez sesji)**: ekran startowy oraz autoryzacja (logowanie/rejestracja).
- **Strefę chronioną (wymaga sesji Supabase JWT)**: `Dashboard`, generowanie + weryfikacja, kolekcja fiszek, panel użytkownika (quota + historia generowań), widok nauki.

Założenia architektoniczne dla doświadczenia użytkownika:

- **Ochrona dostępu**: każda trasa poza autoryzacją wymaga aktywnej sesji. Brak sesji lub `401` z API → bezpieczne wygaszenie sesji + przekierowanie do logowania (z opcjonalnym `returnTo`).
- **Przewidywalne stany asynchroniczne**: standard dla list i mutacji: loading, empty state, error state, retry.
- **Generowanie jest synchroniczne i kosztowne**: UI stosuje blokujący loader, wyraźny stan „w trakcie”, kontrolę długości 1k–20k znaków i obsługę typowych błędów (limit dzienny, low-quality input, timeout/problemy dostawcy).
- **Konsekwentna semantyka `source`**: w UI konsekwentnie oznaczamy fiszki jako `manual`, `ai`, `ai-edited` i używamy tego w filtrach, ikonografii oraz opisach.

Mapowanie domeny UI → API (rdzeń):

- **Generowanie**: `POST /generations` → proposals + `generation.id` + `dailyLimit`.
- **Zapis zaakceptowanych/edytowanych**: `POST /flashcards` (zbiorczo) z `source` i (dla AI) `generationId`.
- **Kolekcja**: `GET /flashcards` (paginacja, search, filtr `source`, sort), `PUT /flashcards/{id}`, `DELETE /flashcards/{id}`, opcjonalnie `GET /flashcards/{id}`.
- **Panel użytkownika**: `GET /generations/quota`, `GET /generations` (historia), `GET /generations/{id}` (szczegóły).

## 2. Lista widoków

### 2.1 Start / Landing

- **Nazwa widoku**: Start
- **Ścieżka widoku**: `/`
- **Główny cel**: wejście do aplikacji i skierowanie do logowania/rejestracji.
- **Kluczowe informacje do wyświetlenia**: krótki opis wartości („generuj fiszki z tekstu”), CTA do logowania/rejestracji.
- **Kluczowe komponenty widoku**: CTA Buttons („Zaloguj”, „Utwórz konto”), krótka sekcja „Jak to działa”.
- **UX, dostępność i względy bezpieczeństwa**:
  - Jasny podział akcji, pełna obsługa klawiatury.
  - Brak danych wrażliwych; brak wywołań API wymagających sesji.
- **Wymagania (PRD) / US**: wsparcie wejścia do FR-01 (US-001, US-002).

### 2.2 Logowanie

- **Nazwa widoku**: Logowanie
- **Ścieżka widoku**: `/auth/login`
- **Główny cel**: uwierzytelnienie użytkownika i utworzenie sesji.
- **Kluczowe informacje do wyświetlenia**: formularz (email, hasło), komunikaty walidacyjne, ogólny błąd logowania.
- **Kluczowe komponenty widoku**: Form, Input (email/hasło), Button (submit), Alert (błąd), Link do rejestracji.
- **UX, dostępność i względy bezpieczeństwa**:
  - Walidacja formatu email po stronie klienta (wczesna informacja).
  - Błąd logowania jako komunikat ogólny (nie ujawnia, czy email istnieje).
  - Po sukcesie przekierowanie do `/dashboard` (lub `returnTo`).
- **Wymagania (PRD) / US**: FR-01.2 (US-002), US-004.

### 2.3 Rejestracja

- **Nazwa widoku**: Rejestracja
- **Ścieżka widoku**: `/auth/register`
- **Główny cel**: stworzenie konta i automatyczne zalogowanie.
- **Kluczowe informacje do wyświetlenia**: formularz (email, hasło, powtórz hasło), wymagania hasła (min. 8), błąd zajętego emaila.
- **Kluczowe komponenty widoku**: Form, Input, Password strength hints, Alert (błędy), Link do logowania.
- **UX, dostępność i względy bezpieczeństwa**:
  - Wyraźne komunikaty walidacji (email, hasło, zgodność haseł).
  - Komunikat, gdy email jest już użyty (czytelny, bez technicznych detali).
  - Po sukcesie przekierowanie do `/dashboard`.
- **Wymagania (PRD) / US**: FR-01.1 (US-001), US-003.

### 2.4 Dashboard (panel główny)

- **Nazwa widoku**: Dashboard
- **Ścieżka widoku**: `/dashboard`
- **Główny cel**: szybki start po zalogowaniu i skróty do kluczowych zadań.
- **Kluczowe informacje do wyświetlenia**:
  - Kafelek CTA „Generuj fiszki”.
  - „Ostatnio dodane fiszki” (5 ostatnich po `updatedAt desc`).
  - „Ostatnie generowania” (5 ostatnich po `createdAt desc`).
- **Kluczowe komponenty widoku**:
  - Tile/Card grid (3 kafle).
  - Lista skrócona fiszek (mini-list).
  - Lista skrócona generowań (mini-list + status badge).
- **Integracja z API**:
  - `GET /flashcards?page=1&pageSize=5&sort=updatedAt&order=desc`
  - `GET /generations?page=1&pageSize=5&sort=createdAt&order=desc`
- **UX, dostępność i względy bezpieczeństwa**:
  - Widoczne „stany puste” (pierwsze użycie) + CTA do generowania/dodania manualnie.
  - Klawiaturowa nawigacja po kartach/listach.
  - Trasa chroniona; `401` → redirect do login.
- **Wymagania (PRD) / US**: punkt startowy dla US-006, US-014, US-017.

### 2.5 Generowanie fiszek i ich weryfikacja

- **Nazwa widoku**: Generowanie fiszek i ich weryfikacja
- **Ścieżka widoku**: `/generate`
- **Główny cel**: wklejenie tekstu i uruchomienie `POST /generations`, następnie ich weryfikacja i zbiorczy zapis poprzez `POST /flashcards`
- **Kluczowe informacje do wyświetlenia**:
  - Pole tekstowe z licznikiem znaków i regułą 1,000–20,000.
  - Stan generowania (blokujący) oraz komunikaty błędów (walidacja, limit, low quality, błąd dostawcy).
  - Po wygenerowaniu dodatkowo:
    - Lista propozycji (front/back) w trybie read-only.
    - Stan każdej propozycji: nieprzejrzana / zaakceptowana / odrzucona / edytowana.
    - Ostrzeżenie: „Odświeżenie strony spowoduje utratę propozycji (MVP)”.
    - Akcje końcowe: „Zapisz wszystkie” oraz „Zapisz zatwierdzone”.
- **Kluczowe komponenty widoku**:
  - Textarea + licznik + inline validation.
  - Button „Generuj” (disabled poza zakresem).
  - Blocking loader (dialog/overlay) w trakcie generowania.
  - Alert/Toast dla błędów + „Spróbuj ponownie”.
  - Po wygenerowaniu dodatkowo:
    - Lista propozycji (karty) z akcjami per fiszka: Accept / Reject / Edit.
    - Edycja w tym samym kafelku fiszki ((Kafelek zamienia się w wersję edytowalną: textarea dla każdego edytowalnego pola)): pola `front` (≤200) i `back` (≤500), walidacja, zapis lokalny.
    - Summary bar (liczniki: zaakceptowane/odrzucone/pozostałe) + CTA zapisu.
    - Blocking loader podczas `POST /flashcards`.
- **Integracja z API**:
  - `POST /generations { text }`
  - `POST /flashcards { flashcards: [...] }`
- **UX, dostępność i względy bezpieczeństwa**:
  - Disabled + komunikat, dlaczego akcja jest niedostępna (długość/limit).
  - Przy `403` (limit): komunikat o braku dostępnych generowań + link do panelu użytkownika, gdzie quota jest prezentowana.
  - Retry po timeout/problematycznej sieci; nie „gubić” wklejonego tekstu.
  - Przy `400` z API (walidacja) → wskazanie problematycznych pól (front/back).
  - Czytelne stany po decyzji (np. wyszarzenie, badge stanu).
  - Trasa chroniona; `401` → redirect do login.
- **Wymagania (PRD) / US**: FR-02.1/02.2/02.4/02.5 (US-006, US-007, US-008, US-009), FR-03.1–03.4, FR-06.1–06.2 (US-010, US-011, US-012)

### 2.6 Kolekcja fiszek (lista / wyszukiwanie / filtry)

- **Nazwa widoku**: Moja kolekcja
- **Ścieżka widoku**: `/flashcards`
- **Główny cel**: przegląd i zarządzanie zapisanymi fiszkami.
- **Kluczowe informacje do wyświetlenia**:
  - Lista fiszek (front/back, daty, źródło).
  - Filtrowanie po `source` i wyszukiwanie po treści.
  - Paginacja, sortowanie (np. `updatedAt desc` jako domyślne).
- **Kluczowe komponenty widoku**:
  - Search input + Filter (source) + Sort controls.
  - Lista/siatka fiszek z akcjami: „Edytuj”, „Usuń”.
  - Paginacja.
  - Oznaczenia źródła (ikonka + tooltip): „AI”, „AI (edytowana)”, „Manualna”.
- **Integracja z API**:
  - `GET /flashcards?search=&source=&page=&pageSize=&sort=&order=`
  - Po mutacjach: odświeżenie listy (lub aktualizacja lokalna) zgodnie z parametrami.
- **UX, dostępność i względy bezpieczeństwa**:
  - Empty state dla braku wyników (osobno: brak danych vs brak dopasowań filtra).
  - Stan ładowania dla zmian parametrów listy.
  - `401` → redirect do login.
- **Wymagania (PRD) / US**: FR-04.2 (US-014).

### 2.7 Dodawanie fiszki manualnej

- **Nazwa widoku**: Dodaj fiszkę
- **Ścieżka widoku**: Uruchamiana z widoku `/flashcards`
- **Główny cel**: stworzenie fiszki od zera (`source="manual"`).
- **Kluczowe informacje do wyświetlenia**: formularz `front` (≤200) i `back` (≤500), walidacja, status zapisu.
- **Kluczowe komponenty widoku**:
  - Form + walidacja długości, przyciski Zapisz/Anuluj.
  - Po sukcesie: informacja + powrót do listy (z widoczną nową fiszką).
- **Integracja z API**:
  - `POST /flashcards { flashcards: [{ front, back, source:"manual" }] }`
- **UX, dostępność i względy bezpieczeństwa**:
  - Focus management po otwarciu modala; czytelne błędy inline.
  - `401` → redirect do login.
- **Wymagania (PRD) / US**: FR-04.1 (US-013).

### 2.9 Edycja fiszki (kolekcja)

- **Nazwa widoku**: Edycja fiszki
- **Ścieżka widoku**: w ramach `/flashcards` (Kafelek z fiszką zamienia się w wersję edytowalną: textarea dla każdego edytowalnego pola)
- **Główny cel**: edycja treści fiszki (front/back) i zapis zmian.
- **Kluczowe informacje do wyświetlenia**: aktualne wartości, ograniczenia długości, informacja o źródle (i konsekwencji: AI → `ai-edited` po modyfikacji).
- **Kluczowe komponenty widoku**:
  - Textarea dla każdego edytowalnego pola
  - Potwierdzenie zapisu i feedback o powodzeniu.
- **Integracja z API**:
  - `PUT /flashcards/{id} { front?, back? }`
- **UX, dostępność i względy bezpieczeństwa**:
  - Jeśli fiszka była `ai` i treść się zmienia to ustawiamy `source="ai-edited"`
  - `404` → komunikat „Nie znaleziono fiszki” (np. po usunięciu w innej karcie).
  - `401` → redirect do login.
- **Wymagania (PRD) / US**: FR-04.3 (US-015), FR-06.2.

### 2.10 Usuwanie fiszki (kolekcja)

- **Nazwa widoku**: Usuwanie fiszki
- **Ścieżka widoku**: w ramach `/flashcards` (AlertDialog)
- **Główny cel**: trwałe usunięcie fiszki.
- **Kluczowe informacje do wyświetlenia**: ostrzeżenie o nieodwracalności, skrót treści fiszki.
- **Kluczowe komponenty widoku**: AlertDialog z przyciskami „Usuń” i „Anuluj”.
- **Integracja z API**:
  - `DELETE /flashcards/{id}`
- **UX, dostępność i względy bezpieczeństwa**:
  - Dialog z poprawnym fokusowaniem i obsługą ESC.
  - `404` → traktować jako „już usunięto” i odświeżyć listę.
- **Wymagania (PRD) / US**: FR-04.4 (US-016).

### 2.11 Panel użytkownika (konto + quota + historia generowań)

- **Nazwa widoku**: Konto
- **Ścieżka widoku**: `/account`
- **Główny cel**: zarządzanie sesją oraz diagnostyka (limit i historia generowań).
- **Kluczowe informacje do wyświetlenia**:
  - Email użytkownika.
  - Przycisk „Wyloguj”.
  - Quota generowań: `remaining`, `limit`, `resetsAtUtc`.
  - Historia generowań: lista z filtrem statusu i paginacją.
- **Kluczowe komponenty widoku**:
  - Sekcja profilu (email, logout).
  - Quota card/badge + opis resetu (UTC przeliczony na lokalny czas prezentacji).
  - Tabela/lista generowań: status, data, link do szczegółu.
  - Po kliknięciu na ikonę szczegółu pojawia się dialog ze szczegółami generacji
- **Integracja z API**:
  - `GET /generations/quota`
  - `GET /generations?status=&page=&pageSize=&sort=&order=`
- **UX, dostępność i względy bezpieczeństwa**:
  - Wylogowanie dostępne także globalnie (topbar) i w koncie.
  - Widok i filtrowanie historii wspiera rozwiązywanie problemów („dlaczego nie wygenerowało”).
  - `401` → redirect do login.
- **Wymagania (PRD) / US**: FR-01.4 (US-005), FR-02.5 (US-009), potrzeby diagnostyki generowania.

### 2.13 Nauka (sesja)

- **Nazwa widoku**: Nauka
- **Ścieżka widoku**: `/study`
- **Główny cel**: umożliwić sekwencyjne powtórki (front → pokaż odpowiedź → ocena).
- **Kluczowe informacje do wyświetlenia**: front fiszki, po odsłonięciu: back, przyciski oceny (np. 3–4 poziomy).
- **Kluczowe komponenty widoku**:
  - Flashcard viewer.
  - Button „Pokaż odpowiedź”.
  - Panel oceny po odsłonięciu odpowiedzi.
- **Integracja z API**:
  - MVP: brak doprecyzowanych endpointów w planie API (integracja odroczona).
- **UX, dostępność i względy bezpieczeństwa**:
  - Duże, czytelne typograficznie treści; obsługa klawiatury (np. space/enter do odsłonięcia).
  - Jasny komunikat „Tryb MVP: integracja harmonogramu w przygotowaniu”, jeśli brak danych.
- **Wymagania (PRD) / US**: FR-05.2 (US-017, US-018) – zakres UI, bez pełnej integracji danych.

### 2.14 Widoki systemowe (błędy i stany)

- **Nazwa widoku**: 404 / Brak dostępu / Błąd serwera
- **Ścieżka widoku**: automatyczne (fallback) lub `/not-found`, `/error`
- **Główny cel**: bezpiecznie zakończyć ścieżkę użytkownika i umożliwić powrót.
- **Kluczowe informacje do wyświetlenia**: co się stało, co można zrobić dalej (powrót, ponów).
- **Kluczowe komponenty widoku**: Error page layout, Button „Wróć do Dashboard”, Button „Zaloguj”.
- **UX, dostępność i względy bezpieczeństwa**:
  - Nie wyświetlać surowych błędów technicznych ani danych wrażliwych.
  - Dla `401`: czytelny komunikat „Sesja wygasła”.

## 3. Mapa podróży użytkownika

### 3.1 Onboarding i wejście do aplikacji

- `/` → wybór: `/auth/register` lub `/auth/login`
- Rejestracja/logowanie → sukces → `/dashboard`
- W każdej chwili: „Wyloguj” (topbar lub `/account`) → koniec sesji → `/auth/login` (lub `/`)

### 3.2 Główny przypadek użycia MVP: generowanie → weryfikacja → zapis

1. Użytkownik wchodzi na `/dashboard`.
2. Klik „Generuj fiszki” → `/generate`.
3. Wkleja tekst (1k–20k), widzi licznik i walidację na żywo.
4. Klik „Generuj”:
   - UI pokazuje blokujący loader.
   - `POST /generations`:
     - `201` → UI wyświetla tabelę z fiszkami w pamięci
     - `422 low_quality_input` → UI pokazuje komunikat jakości, pozostaje na `/generate`.
     - `403 limit_exceeded` → UI pokazuje komunikat o limicie i link do `/account` (quota), pozostaje na `/generate`.
     - `500 provider_error` / timeout → UI pokazuje błąd + „Spróbuj ponownie”.
5. Po wyświetleniu propozycji użytkownik:
   - akceptuje / odrzuca / edytuje propozycje,
   - wybiera „Zapisz wszystkie” lub „Zapisz zatwierdzone”.
6. UI wysyła `POST /flashcards` (zbiorczo) i blokuje interakcje na czas zapisu:
   - sukces → komunikat powodzenia + przejście do `/flashcards` (lub `/dashboard`).
   - błąd → komunikat + możliwość ponowienia (bez utraty lokalnych decyzji).

### 3.3 Zarządzanie kolekcją

- `/flashcards`:
  - wyszukiwanie + filtry + paginacja (z parametrami w URL),
  - edycja (w tym samym oknie) → `PUT /flashcards/{id}` → odświeżenie listy,
  - usunięcie (AlertDialog dla potwierdzenia) → `DELETE /flashcards/{id}` → odświeżenie listy,
  - „Dodaj manualnie” → `/flashcards/new` (lub modal) → `POST /flashcards`.

### 3.4 Diagnostyka i limit generowania

- `/account`:
  - quota: `GET /generations/quota`
  - historia: `GET /generations` z filtrem statusu
  - szczegóły: klik w pozycję → `/account/generations/{id}` → `GET /generations/{id}`

### 3.5 Nauka (UI)

- `/study`:
  - start sesji (UI) → pokaż front → „Pokaż odpowiedź” → ocena
  - integracja algorytmu/źródła danych: odroczona (brak endpointów w planie API)

## 4. Układ i struktura nawigacji

### 4.1 Globalny layout (App Shell)

- **Topbar** (desktop): `Navigation Menu` z linkami:
  - `Dashboard` (`/dashboard`)
  - `Generuj` (`/generate`)
  - `Kolekcja` (`/flashcards`)
  - `Nauka` (`/study`)
  - `Konto` (`/account`)
- **Prawa strona topbaru**:
  - menu użytkownika (email skrócony) + akcja „Wyloguj”.
- **Mobile**:
  - hamburger otwierający listę tych samych pozycji, z poprawnymi stanami aktywnymi, wsparciem klawiatury i ARIA.

### 4.2 Zasady dostępu i przekierowań

- Strefa publiczna: `/`, `/auth/*`.
- Strefa chroniona: wszystko pozostałe.
- Próba wejścia bez sesji lub `401` z API:
  - wyczyść stan sesji w UI,
  - przekieruj do `/auth/login`,
  - opcjonalnie zachowaj cel jako `returnTo`.

## 5. Kluczowe komponenty

- **`AppShell` / `ProtectedLayout`**: wspólny layout dla strefy zalogowanej (topbar + kontener treści) oraz ochrona tras.
- **`AuthForms`**: wspólne elementy formularzy logowania i rejestracji (walidacja, obsługa błędów).
- **`GenerateFlaschards`**: komponent generowania fiszek z polem tekstowym, przyciskiem uruchamiającym proces
- **`BlockingLoader`**: warstwa blokująca interakcje podczas generowania i zbiorczego zapisu.
- **`ErrorAlert` + `Toast`**: spójna prezentacja błędów (walidacja, sieć, limit, low quality).
- **`FlashcardList` + `FlashcardCardRow`**: render listy fiszek (kolekcja) i propozycji (weryfikacja) z opcjami edycji i usuwania.
- **`FlashcardEditor`**: komopnent umożliwiający edycję fiszki `front/back` (limity, walidacja, focus management).
- **`ConfirmDeleteAlertDialog`**: potwierdzenie nieodwracalnych operacji.
- **`SourceBadge`**: ikonka/etykieta `manual` vs `ai` vs `ai-edited` (spójna w całej aplikacji).
- **`Pagination` + `QueryStateSync`**: paginacja i synchronizacja filtrów/sortowania z URL (dla spójnego UX „back/forward”).
- **`GenerationHistoryTable` + `GenerationStatusBadge`**: historia generowań (filtrowanie, link do szczegółu).
- **`QuotaCard`**: prezentacja limitu i czasu resetu (wyłącznie w panelu użytkownika).

### 5.1 Mapowanie historyjek użytkownika (PRD) do widoków

- **US-001** Rejestracja → `/auth/register`
- **US-002** Logowanie → `/auth/login`
- **US-003** Rejestracja na istniejący email (błąd) → `/auth/register`
- **US-004** Nieudane logowanie (błąd) → `/auth/login`
- **US-005** Wylogowanie → globalnie (topbar) + `/account`
- **US-006** Generowanie z poprawnego tekstu → `/generate` → zapis `POST /flashcards`
- **US-007** Długość tekstu poza zakresem → `/generate` (walidacja + disabled)
- **US-008** Tekst niskiej jakości → `/generate` (komunikat po `422`)
- **US-009** Limit dzienny → `/generate` (komunikat/disabled po `403`) + szczegóły w `/account` (quota)
- **US-010** Akceptacja propozycji → `/generate`
- **US-011** Odrzucenie propozycji → `/generate`
- **US-012** Edycja i akceptacja propozycji → `/generate` (edytor)
- **US-013** Manualne tworzenie fiszki → wywołanie z `/flashcards`
- **US-014** Przeglądanie kolekcji → `/flashcards`
- **US-015** Edycja fiszki → `/flashcards`  + `PUT /flashcards/{id}`
- **US-016** Usuwanie fiszki → `/flashcards` (AlertDialog) + `DELETE /flashcards/{id}`
- **US-017** Rozpoczęcie nauki → `/study` (UI) + CTA z `/dashboard`
- **US-018** Odkrywanie odpowiedzi + ocena → `/study`

### 5.2 Mapowanie kluczowych wymagań (FR) do elementów UI

- **FR-01 System Kont**:
  - `/auth/login`, `/auth/register`, globalny „Wyloguj”, ochrona tras + obsługa `401`.
- **FR-02 Generowanie przez AI**:
  - `/generate`: textarea 1k–20k + licznik + walidacja, blocking loader, komunikaty `422/403/500`, retry.
- **FR-03 Weryfikacja i zapis**:
  - `/generate`: lista read-only + akcje per propozycja + edytor (limity 200/500) + zbiorczy zapis `POST /flashcards`.
- **FR-04 Kolekcja i CRUD**:
  - `/flashcards` (list/search/filter/pagination), edycja, usuwanie (AlertDialog), dodawanie manualne.
- **FR-05 Nauka**:
  - `/study`: front → reveal back → ocena (integracja danych odroczona).


