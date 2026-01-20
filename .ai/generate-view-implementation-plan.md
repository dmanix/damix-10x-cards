## Plan implementacji widoku Generowanie fiszek i ich weryfikacja (`/generate`)

## 1. Przegląd
Widok `/generate` realizuje pełny przepływ MVP: użytkownik wkleja tekst (1,000–20,000 znaków), uruchamia synchroniczne generowanie przez `POST /generations`, a następnie weryfikuje propozycje fiszek (zaakceptuj/odrzuć/edytuj) i zapisuje je zbiorczo przez `POST /flashcards`.

Kluczowe wymagania:
- Walidacja długości tekstu (1,000–20,000) i pól fiszki (`front` ≤ 200, `back` ≤ 500) zgodnie z API.
- Blokujący loader podczas generowania i zapisu.
- Czytelne stany propozycji: nieprzejrzana / zaakceptowana / odrzucona / edytowana (zaakceptowana po edycji).
- Obsługa błędów: długość/format requestu (400), limit dzienny (403), low quality (422), błąd dostawcy/serwera (500), 401 → redirect do logowania.
- MVP: brak persistencji propozycji — odświeżenie strony = utrata propozycji (pokazać ostrzeżenie).

## 2. Routing widoku
- **Ścieżka**: `src/pages/generate.astro` → dostępna pod `/generate`.
- **Ochrona trasy**:
  - Docelowo (zgodnie z założeniami projektu): wymaga aktywnej sesji Supabase JWT.
  - Implementacyjnie w Astro: na etapie renderu strony sprawdzić sesję/użytkownika (np. `Astro.locals.supabase.auth.getUser()` / `getSession()`), a przy braku sesji wykonać redirect do `/auth/login` (opcjonalnie z `returnTo=/generate`).
  - Dodatkowo po stronie klienta: każda odpowiedź `401` z API powinna przekierować do `/auth/login` (z zachowaniem `returnTo`).

## 3. Struktura komponentów
Rekomendowana struktura plików (propozycja):
- `src/pages/generate.astro` (routing + layout + mount React)
- `src/components/generate/GenerateView.tsx` (kontener widoku, stan i integracja API)
- `src/components/generate/GenerateInputPanel.tsx`
- `src/components/generate/BlockingOverlay.tsx`
- `src/components/generate/GenerationErrorNotice.tsx` (alert/inline error + retry)
- `src/components/generate/ProposalsReviewPanel.tsx`
- `src/components/generate/ProposalsSummaryBar.tsx`
- `src/components/generate/ProposalCard.tsx`
- `src/components/generate/ProposalEditor.tsx`

## 4. Szczegóły komponentów

### `src/pages/generate.astro`
- **Opis**: Strona Astro odpowiedzialna za routing i ochronę dostępu; renderuje layout i montuje komponent React.
- **Główne elementy**:
  - `Layout.astro`
  - `<GenerateView client:load />` (lub `client:visible`, jeśli chcemy opóźnić JS; dla UX generowania zwykle `client:load`).
- **Obsługiwane interakcje**: brak (to shell).
- **Walidacja**: brak.
- **Typy**: brak.
- **Propsy**: przekazuje do React ewentualne dane sesji/użytkownika (opcjonalnie), np. `initialQuota` jeśli w przyszłości będzie `GET /generations/quota`.

### `GenerateView` (`src/components/generate/GenerateView.tsx`)
- **Opis**: Główny kontener widoku; trzyma cały stan formularza, stan generowania, listę propozycji oraz integrację z API.
- **Główne elementy**:
  - `GenerateInputPanel`
  - `BlockingOverlay` (dla `isGenerating` i `isSaving`)
  - `GenerationErrorNotice` (dla błędów generowania i zapisu)
  - `ProposalsReviewPanel` (renderowane po sukcesie `POST /generations`)
- **Obsługiwane interakcje**:
  - Zmiana tekstu wejściowego.
  - Klik „Generuj”.
  - Akcje na propozycjach: Accept/Reject/Edit/Cancel/Edit+Accept.
  - Klik „Zapisz wszystkie” / „Zapisz zatwierdzone”.
  - Retry po błędzie generowania lub zapisu.
- **Walidacja (frontend)**:
  - Wejście `text`: `trim()` + licznik znaków; blokada „Generuj” poza zakresem 1,000–20,000 (po trimie).
  - Propozycje:
    - `front`: 1–200 po `trim()`
    - `back`: 1–500 po `trim()`
    - Przy zapisie: dla każdej zapisywanej fiszki budować `source` oraz `generationId` zgodnie z regułami API.
- **Typy (DTO + ViewModel)**:
  - DTO: `GenerationCreateCommand`, `GenerationStartResponse`, `CreateFlashcardsCommand`, `CreateFlashcardsResponse`, `ErrorResponse`, `DailyLimitDto`, `ProposalDto` (z `src/types.ts`).
  - VM: `GenerationSessionVm`, `ProposalVm`, `ProposalDecision`, `GenerateViewState`.
- **Propsy**:
  - (opcjonalnie) `initialText?: string`
  - (opcjonalnie) `returnToOnAuth?: string` (domyślnie `/generate`)

### `GenerateInputPanel` (`src/components/generate/GenerateInputPanel.tsx`)
- **Opis**: Panel do wklejenia tekstu; pokazuje licznik, inline walidację, stan limitu oraz CTA „Generuj”.
- **Główne elementy**:
  - shadcn `Textarea`
  - licznik znaków (np. „1234 / 20000”)
  - komunikat walidacyjny (min/max)
  - `Button` (`src/components/ui/button.tsx`)

- **Obsługiwane interakcje**:
  - `onChange(text)`
  - `onSubmitGenerate()`
- **Walidacja**:
  - `textTrimmed.length < 1000` → komunikat + disabled przycisku.
  - `textTrimmed.length > 20000` → komunikat + disabled przycisku.
  - `dailyLimit.remaining === 0` (jeśli znane) → disabled + komunikat o limicie i link do `/account`.
- **Typy**:
  - `DailyLimitVm` (na bazie `DailyLimitDto`, ale dopuszcza `undefined` gdy nieznane).
- **Propsy** (interfejs komponentu):
  - `value: string`
  - `onChange: (value: string) => void`
  - `onGenerate: () => void`
  - `isGenerating: boolean`
  - `dailyLimit?: DailyLimitDto`
  - `validationMessage?: string`

### `BlockingOverlay` (`src/components/generate/BlockingOverlay.tsx`)
- **Opis**: Nakładka blokująca UI w trakcie `POST /generations` i `POST /flashcards`.
- **Główne elementy**:
  - `<div role="dialog" aria-modal="true">` lub prosty overlay z `aria-busy="true"` na głównym kontenerze.
  - spinner (może być prosty CSS/Tailwind) + tekst „Generuję…” / „Zapisuję…”.
- **Obsługiwane interakcje**: brak (blokujący).
- **Walidacja**: brak.
- **Typy**: brak.
- **Propsy**:
  - `open: boolean`
  - `label: string` (np. „Generowanie fiszek…”)

### `GenerationErrorNotice` (`src/components/generate/GenerationErrorNotice.tsx`)
- **Opis**: Wspólny komponent do prezentowania błędów (alert inline) oraz akcji „Spróbuj ponownie”.
- **Główne elementy**:
  - `Card`/`div` z `role="alert"`
  - treść błędu (przyjazna, z mapowaniem kodów API)
  - `Button` „Spróbuj ponownie” (gdy retry ma sens)
  - link do `/account` przy limicie
- **Obsługiwane interakcje**:
  - `onRetry()`
  - (opcjonalnie) `onDismiss()`
- **Walidacja**: brak.
- **Typy**:
  - `ApiErrorVm` (opisany w sekcji 5).
- **Propsy**:
  - `error: ApiErrorVm | null`
  - `onRetry?: () => void`

### `ProposalsReviewPanel` (`src/components/generate/ProposalsReviewPanel.tsx`)
- **Opis**: Sekcja widoku po udanym generowaniu; pokazuje listę propozycji i pasek podsumowania z CTA zapisu.
- **Główne elementy**:
  - `ProposalsSummaryBar`
  - lista `ProposalCard` (zaakceptowane propozycje są inaczej podświetlone np. na inny kolor)
- **Obsługiwane interakcje**:
  - przekazywanie handlerów do `ProposalCard`
  - klik „Zapisz wszystkie” / „Zapisz zatwierdzone”
- **Walidacja**:
  - CTA zapisu disabled, jeśli nie ma nic do zapisania wg wybranego trybu.
- **Typy**:
  - `GenerationSessionVm`
  - `ProposalVm[]`
- **Propsy**:
  - `session: GenerationSessionVm`
  - `proposals: ProposalVm[]`
  - `onAccept(id)`
  - `onReject(id)`
  - `onStartEdit(id)`
  - `onCancelEdit(id)`
  - `onSaveEditAndAccept(id, nextFront, nextBack)`
  - `onSaveAll()`
  - `onSaveApproved()`
  - `isSaving: boolean`

### `ProposalsSummaryBar` (`src/components/generate/ProposalsSummaryBar.tsx`)
- **Opis**: Pasek podsumowania statusów i główne CTA zapisu.
- **Główne elementy**:
  - liczniki: zaakceptowane / odrzucone / pozostałe (nieprzejrzane)
  - `Button` „Zapisz wszystkie”
  - `Button` „Zapisz zatwierdzone”
- **Obsługiwane interakcje**:
  - `onSaveAll()`
  - `onSaveApproved()`
- **Walidacja**:
  - „Zapisz zatwierdzone” disabled, jeśli \(acceptedCount = 0\) lub trwa zapis
  - „Zapisz wszystkie” disabled, jeśli \(nonRejectedCount = 0\) lub trwa zapis
- **Typy**:
  - `ProposalsSummaryVm`
- **Propsy**:
  - `summary: ProposalsSummaryVm`
  - `onSaveAll: () => void`
  - `onSaveApproved: () => void`
  - `isSaving: boolean`

### `ProposalCard` (`src/components/generate/ProposalCard.tsx`)
- **Opis**: Kafelek pojedynczej propozycji; w trybie read-only pokazuje front/back oraz badge stanu i akcje.
- **Główne elementy**:
  - `Card`
  - `Badge` stanu (shadcn `Badge`)
  - Sekcja front/back (read-only)
  - Akcje:
    - `Button` „Zaakceptuj”
    - `Button` „Odrzuć”
    - `Button` „Edytuj”
  - Gdy `isEditing=true` → render `ProposalEditor` zamiast read-only.
- **Obsługiwane interakcje**:
  - `onAccept()`, `onReject()`, `onEdit()`
- **Walidacja**:
  - W trybie read-only brak; w trybie edycji delegacja do `ProposalEditor`.
- **Typy**:
  - `ProposalVm`
- **Propsy**:
  - `proposal: ProposalVm`
  - `onAccept: () => void`
  - `onReject: () => void`
  - `onEdit: () => void`
  - `onCancelEdit: () => void`
  - `onSaveEditAndAccept: (front: string, back: string) => void`

### `ProposalEditor` (`src/components/generate/ProposalEditor.tsx`)
- **Opis**: Inline edytor w kafelku; pozwala edytować `front` i `back` z walidacją i licznikami.
- **Główne elementy**:
  - dwa pola `<textarea>` lub `<input>` (dla `front` można rozważyć `textarea` 2–3 linie)
  - liczniki (front ≤ 200, back ≤ 500)
  - inline błędy per pole
  - `Button` „Zapisz i zaakceptuj”
  - `Button` „Anuluj”
- **Obsługiwane interakcje**:
  - `onChangeFront`, `onChangeBack`
  - `onSaveAndAccept()`
  - `onCancel()`
- **Walidacja** (spójna z `src/lib/validation/flashcards.ts`):
  - `front.trim().length` w zakresie 1–200
  - `back.trim().length` w zakresie 1–500
  - Disable „Zapisz i zaakceptuj” dopóki pola są niepoprawne
- **Typy**:
  - `ProposalEditVm` (lokalny stan edycji)
- **Propsy**:
  - `initialFront: string`
  - `initialBack: string`
  - `onSaveAndAccept: (front: string, back: string) => void`
  - `onCancel: () => void`

## 5. Typy
Wykorzystać istniejące DTO z `src/types.ts` oraz dodać ViewModel’e dla UI.

### DTO (istniejące, z `src/types.ts`)
- `GenerationCreateCommand`
- `GenerationStartResponse`:
  - `generation: { id: string; status: "succeeded"; createdAt: string }`
  - `proposals: ProposalDto[]` gdzie `ProposalDto = { front: string; back: string }`
  - `dailyLimit: DailyLimitDto` (`remaining`, `limit`, `resetsAtUtc`)
- `CreateFlashcardsCommand` / `CreateFlashcardsResponse`
- `ErrorResponse` (kontrakt ogólny: `code`, `message`, opcjonalnie `details`)

### Nowe typy ViewModel (propozycja)

#### `type ProposalDecision = "unreviewed" | "accepted_original" | "accepted_edited" | "rejected"`
Semantyka:
- `unreviewed`: brak decyzji użytkownika.
- `accepted_original`: zaakceptowana bez zmian.
- `accepted_edited`: zaakceptowana po edycji.
- `rejected`: odrzucona.

#### `interface ProposalVm`
- `id: string` (np. `crypto.randomUUID()` po stronie klienta; potrzebne do stabilnych kluczy listy)
- `original: { front: string; back: string }`
- `current: { front: string; back: string }` (to, co zapisujemy; na start równe `original`)
- `decision: ProposalDecision`
- `isEditing: boolean`

#### `interface GenerationSessionVm`
- `generationId: string`
- `createdAt: string`
- `dailyLimit: DailyLimitDto`

#### `interface ProposalsSummaryVm`
- `acceptedCount: number` (accepted_original + accepted_edited)
- `rejectedCount: number`
- `unreviewedCount: number`
- `editedCount: number`
- `totalAllCount: number`

#### `type ApiErrorKind = "validation" | "daily_limit" | "low_quality" | "provider" | "network" | "unauthorized" | "unknown"`

#### `interface ApiErrorVm`
- `kind: ApiErrorKind`
- `status?: number`
- `code?: string`
- `message: string` (tekst do UI po polsku)
- `canRetry: boolean`
- `action?: { type: "link"; href: string; label: string }` (np. limit → link do `/account`)

## 6. Zarządzanie stanem
Rekomendacja: lokalny stan w `GenerateView` (React `useState` + `useMemo` + `useCallback`), bez zewnętrznego state managera.

### Potencjalne zmienne stanu w `GenerateView`
- `inputText: string`
- `inputTouched: boolean` (żeby nie pokazywać błędów od razu po wejściu)
- `isGenerating: boolean`
- `isSaving: boolean`
- `generationSession: GenerationSessionVm | null`
- `proposals: ProposalVm[]` (puste przed generowaniem)
- `error: ApiErrorVm | null` (ostatni błąd generowania lub zapisu)

### Custom hook (opcjonalnie, zalecane dla czytelności)
`useGenerateFlashcards()`:
- enkapsuluje:
  - walidację długości tekstu
  - wywołanie `POST /generations`
  - mapowanie odpowiedzi na `GenerationSessionVm` + `ProposalVm[]`
  - mapowanie błędów na `ApiErrorVm`
- zwraca:
  - `generate(text): Promise<void>`
  - `isGenerating`, `error`, `dailyLimit?`

`useSaveFlashcards()`:
- enkapsuluje:
  - budowę `CreateFlashcardsCommand` na podstawie `proposals` + trybu zapisu
  - wywołanie `POST /flashcards`
  - obsługę błędów (w tym `401`)
- zwraca:
  - `saveAll()`, `saveApproved()`
  - `isSaving`, `error`

## 7. Integracja API
Wszystkie wywołania idą do endpointów Astro:

### `POST /api/generations`
- **Request** (`GenerationCreateCommand`):
  - `{ "text": string }`
  - Wysyłać `text` jako `inputText.trim()` (spójne z walidacją backendu).
- **Response 201** (`GenerationStartResponse`):
  - Zapisać `generation.id` jako `generationSession.generationId`.
  - Zmapować `proposals` na `ProposalVm[]`:
    - `original = proposal`
    - `current = proposal`
    - `decision = "unreviewed"`
    - `isEditing = false`
  - Zaktualizować `dailyLimit` w stanie widoku.
- **Response 400**:
  - `code: "invalid_request"` + `message` (np. długość tekstu) → pokazać inline błąd przy polu tekstowym (jeśli dotyczy) + alert.
- **Response 403**:
  - `code: "daily_limit_exceeded"` + `remaining/limit/resetsAtUtc` → zablokować generowanie, pokazać komunikat i link do `/account`.
- **Response 422**:
  - `code: "low_quality_input"` → pokazać czytelny komunikat, pozostać w trybie wejścia (nie przechodzić do listy propozycji).
- **Response 500**:
  - `code: "provider_error"` → komunikat „Nie udało się wygenerować fiszek. Spróbuj ponownie.” + Retry.

### `POST /api/flashcards`
- **Request** (`CreateFlashcardsCommand`):
  - `{ "flashcards": [{ front, back, source, generationId? }] }`
  - Dla tego widoku zawsze zapisujemy fiszki AI:
    - `source = "ai"` jeśli `current` == `original`
    - `source = "ai-edited"` jeśli `current` != `original`
    - `generationId` wymagany (z `generationSession.generationId`)
  - Wysyłać `front/back` jako `trim()` (backend też trimuje, ale frontend powinien być deterministyczny).
- **Tryby zapisu (MVP, zgodnie z ustaleniami UI)**:
  - „Zapisz wszystkie”: zapisz wszystkie fiszki **nieodrzucone**:
    - `unreviewed` traktować jako akceptowane bez zmian (source `ai` lub `ai-edited` jeśli były edytowane i zapisane lokalnie).
  - „Zapisz zatwierdzone”: zapisz tylko `accepted_original` i `accepted_edited`.
- **Response 201**:
  - Możliwe akcje po sukcesie:
    - pozostanie na `/generate` i pokazanie podsumowania + przycisk „Przejdź do kolekcji”
- **Response 400**:
  - `invalid_request` → pokazać błąd; nie ma częściowej obsługi (ponowić cały request po poprawkach).
  - Ponieważ API zwraca jeden komunikat, a nie listę błędów per pole, walidację per fiszka trzeba zrobić po stronie klienta przed wysyłką (żeby móc wskazać konkretny kafelek/pole).
- **Response 401**:
  - natychmiastowy redirect do `/auth/login?returnTo=/generate`
- **Response 403**:
  - `generation_ownership_mismatch` → komunikat o braku uprawnień; sugerować ponowne zalogowanie lub kontakt z supportem.
- **Response 500**:
  - komunikat „Nie udało się zapisać fiszek. Spróbuj ponownie.” + Retry (bez utraty lokalnych decyzji).

## 8. Interakcje użytkownika
Poniżej opis oczekiwanych zachowań UI:

- **Wklejanie/edycja tekstu**:
  - licznik aktualizuje się w czasie rzeczywistym
  - przy błędnej długości: widoczny komunikat i disabled „Generuj”
- **Klik „Generuj”**:
  - uruchamia blokujący loader (overlay), blokuje edycję
  - po sukcesie: pokazuje panel weryfikacji + listę propozycji
  - po błędzie: pokazuje komunikat, umożliwia retry bez utraty tekstu
- **Akcja „Zaakceptuj” na propozycji**:
  - zmiana `decision` na `accepted_original` (jeśli `current==original`) albo `accepted_edited` (jeśli wcześniej edytowano i zapisano lokalnie)
  - wizualnie: badge stanu + zmiana tła kafelka (na jasnozielony)
- **Akcja „Odrzuć”**:
  - zmiana `decision` na `rejected`
  - wizualnie: badge stanu + zmiana tła kafelka (na jasnoczerwony)
- **Akcja „Edytuj”**:
  - kafelek przechodzi w tryb edycji inline (`ProposalEditor`)
  - focus na pierwsze pole edycji
- **„Zapisz i zaakceptuj” w edytorze**:
  - waliduje pola, zapisuje `current`, ustawia `decision="accepted_edited"`, wychodzi z edycji
- **„Anuluj” w edytorze**:
  - odrzuca niezapisane zmiany w edytorze (wraca do `current`), wychodzi z edycji
- **„Zapisz wszystkie”**:
  - blokujący loader, wysyła zbiorczy request
  - po sukcesie: komunikat + stan sukcesu
- **„Zapisz zatwierdzone”**:
  - analogicznie jak 'Zapisz wszystkie', ale tylko dla zaakceptowanych

## 9. Warunki i walidacja
Walidacje w UI powinny odzwierciedlać reguły backendu i wpływać na stany disabled oraz komunikaty.

### Tekst wejściowy (przed generowaniem)
- `textTrimmed = inputText.trim()`
- **Długość**:
  - jeśli `< 1000` → disabled „Generuj” + komunikat „Tekst musi mieć co najmniej 1000 znaków.”
  - jeśli `> 20000` → disabled „Generuj” + komunikat „Tekst może mieć maksymalnie 20000 znaków.”
- **Limit dzienny**:
  - jeśli znane `dailyLimit.remaining === 0` → disabled „Generuj” + komunikat + link do `/account`
  - jeśli limit nieznany (brak `GET /generations/quota` w tym widoku) → pozwolić kliknąć i obsłużyć `403` z `POST /generations`, a potem zablokować kolejne próby w tej sesji.

### Propozycje (weryfikacja/edycja)
- `front`: `trim()` i 1–200 znaków
- `back`: `trim()` i 1–500 znaków
- CTA zapisu powinny być zależne od tego, czy istnieje co najmniej 1 fiszka do zapisania w danym trybie.
- W trakcie `isSaving=true`:
  - disabled wszystkich akcji modyfikujących listę i CTA, aby uniknąć niespójności.

## 10. Obsługa błędów
Mapowanie błędów API na komunikaty UI (propozycja):

- **`POST /generations`**
  - `400 invalid_request`: „Nieprawidłowy tekst wejściowy. Sprawdź długość (1000–20000 znaków).”
  - `403 daily_limit_exceeded`: „Wykorzystałeś dzienny limit generowań. Limit odnowi się: {resetsAtUtc} (UTC).” + link „Zobacz limit w koncie” → `/account`
  - `422 low_quality_input`: „Z tego materiału nie da się wygenerować wartościowych fiszek. Spróbuj wkleić dłuższy lub bardziej merytoryczny fragment.”
  - `500 provider_error`: „Wystąpił błąd podczas generowania. Spróbuj ponownie.”
  - Błędy sieci/timeout: „Problem z połączeniem. Spróbuj ponownie.” (retry zachowuje tekst)

- **`POST /flashcards`**
  - `400 invalid_request`: „Nie udało się zapisać fiszek. Sprawdź długość pól (front ≤ 200, back ≤ 500) i spróbuj ponownie.” (w razie potrzeby przewinąć do pierwszego błędnego kafelka)
  - `401`: redirect do logowania
  - `403 generation_ownership_mismatch`: „Brak uprawnień do tej generacji. Spróbuj zalogować się ponownie.”
  - `500 server_error`: „Nie udało się zapisać fiszek. Spróbuj ponownie.”

Zasady UX błędów:
- Nie czyścić `inputText` ani lokalnych decyzji propozycji po błędzie.
- Retry powinno być dostępne wszędzie, gdzie ma sens (`network`, `provider`, `server_error`).
- Błąd walidacji (frontend) powinien wskazywać konkretne pola (inline), zanim dojdzie do requestu.

## 11. Kroki implementacji
1. **Routing i shell strony**: dodać `src/pages/generate.astro`, osadzić w `Layout.astro`, wyrenderować `GenerateView`.
3. **Szkielet `GenerateView`**: zdefiniować stany (`inputText`, `isGenerating`, `session`, `proposals`, `error`).
4. **Input + walidacja**: zaimplementować `GenerateInputPanel` z licznikiem znaków i regułami 1k–20k (na `trim()`), oraz disabled + „dlaczego” (komunikat).
5. **Wywołanie `POST /generations`**:
   - dodać funkcję `generate()` (lub hook `useGenerateFlashcards`)
   - obsłużyć statusy 201/400/403/422/500 + błędy sieci
   - na 201 zbudować `GenerationSessionVm` i `ProposalVm[]`
6. **Blocking loader**: dodać `BlockingOverlay` i spiąć z `isGenerating`/`isSaving`.
7. **Panel weryfikacji**:
   - dodać `ProposalsReviewPanel`
   - renderować listę `ProposalCard`
8. **Akcje per fiszka**:
   - Accept: ustawienie `decision` (original vs edited)
   - Reject: ustawienie `decision="rejected"` i usunięcie z listy widocznej
   - Edit: przejście do `ProposalEditor` w tym samym kafelku
9. **Edycja i walidacja pól**:
   - `ProposalEditor` z licznikami 200/500 i inline błędami
   - „Zapisz i zaakceptuj” ustawia `current` i `decision="accepted_edited"`
10. **Summary bar i CTA zapisu**:
   - `ProposalsSummaryBar` liczący accepted/rejected/unreviewed
   - disabled CTA w zależności od dostępnych elementów do zapisu
11. **Wywołanie `POST /flashcards`**:
   - zbudować `CreateFlashcardsCommand` zgodnie z trybami:
     - „Zapisz wszystkie” = wszystkie nieodrzucone, `source` zależne od edycji, `generationId` wymagany
     - „Zapisz zatwierdzone” = tylko zaakceptowane
   - obsłużyć 201/400/401/403/500 + sieć
12. **Zachowanie po sukcesie**: ustalić standard (redirect do `/flashcards` lub stan sukcesu na `/generate`) i zaimplementować spójny komunikat.
13. **Dostępność i detale UX**:
   - `aria-invalid` i `aria-describedby` na polach
   - focus management przy przejściu do edycji i przy błędach walidacji
   - sensowne disabled states podczas requestów
14. **Manualny test (checklista)**:
   - tekst 999 → przycisk disabled, komunikat
   - tekst 1000 → generowanie działa
   - tekst 20001 → disabled, komunikat
   - `403` na generowaniu → blokada + link do `/account`
   - `422` low quality → komunikat, brak przejścia do weryfikacji
   - edycja: front > 200 / back > 500 → błędy inline i disabled „Zapisz i zaakceptuj”
   - „Zapisz wszystkie” vs „Zapisz zatwierdzone” → poprawne payloady `source`/`generationId`
   - `401` na zapisie → redirect do login
