# Plan implementacji widoku „Moja kolekcja” (`/flashcards`)

## 1. Przegląd
Widok „Moja kolekcja” pod ścieżką `/flashcards` służy do **przeglądu i zarządzania zapisanymi fiszkami** użytkownika:
- **Lista fiszek** z polami: `front`, `back`, `source`, `createdAt`, `updatedAt`.
- **Wyszukiwanie** po treści (`front`/`back`) oraz **filtrowanie** po `source`.
- **Sortowanie** (domyślnie: `updatedAt desc`) oraz **paginacja**.
- Akcje na fiszce: **Dodaj manualnie**, **Edytuj (inline)**, **Usuń** (z potwierdzeniem).
- **Oznaczenia źródła** (ikonka + tooltip): „AI”, „AI (edytowana)”, „Manualna”.
- Stany UX: `loading` podczas zmian parametrów listy, rozróżnienie empty state: „brak danych” vs „brak dopasowań”.
- Bezpieczeństwo: `401` z API → redirect do logowania z `returnTo=/flashcards`.

Wymagania z PRD/User Stories pokrywane przez ten widok:
- **FR-04.2 / US-014**: przeglądanie kolekcji.
- **FR-04.1 / US-013**: manualne dodawanie fiszki.
- **FR-04.3 / US-015 + FR-06.2**: edycja i konsekwencja `ai → ai-edited` po zmianie treści.
- **FR-04.4 / US-016**: trwałe usuwanie fiszki.

## 2. Routing widoku
- **Ścieżka**: `src/pages/flashcards.astro` → dostępna pod `/flashcards`.
- **Mount React**: `<FlashcardsView client:load />`.
- **Layout**: użyć `src/layouts/Layout.astro` (Topbar jest renderowany automatycznie dla tras innych niż `/` i `/auth/*`).
- **Ochrona dostępu (docelowo)**:
  - w `flashcards.astro` dodać analogiczny guard sesji jak zapowiedziany w `src/pages/generate.astro` (redirect do `/auth/login?returnTo=/flashcards` przy braku sesji).
  - po stronie klienta: każdy `401` z `/api/flashcards*` → `window.location.href = "/auth/login?returnTo=/flashcards"`.

## 3. Struktura komponentów
Rekomendowana struktura plików:
- `src/pages/flashcards.astro` (routing + mount React)
- `src/components/flashcards/FlashcardsView.tsx` (kontener widoku)
- `src/components/flashcards/FlashcardsToolbar.tsx` (search + filter + sort + CTA „Dodaj”)
- `src/components/flashcards/FlashcardsList.tsx` (lista/siatka + stany: loading/empty/error)
- `src/components/flashcards/FlashcardCard.tsx` (karta fiszki + akcje)
- `src/components/flashcards/FlashcardInlineEditor.tsx` (tryb edycji w ramach karty)
- `src/components/flashcards/FlashcardSourceBadge.tsx` (badge + ikonka + tooltip)
- `src/components/flashcards/CreateManualFlashcardDialog.tsx` (modal dodawania manualnego)
- `src/components/flashcards/DeleteFlashcardDialog.tsx` (AlertDialog usuwania)
- `src/components/flashcards/FlashcardsPagination.tsx` (paginacja)
- `src/components/flashcards/api.ts` (wywołania API + mapowanie błędów)
- `src/components/flashcards/types.ts` (ViewModele + helpery mapujące DTO → VM)
- `src/components/hooks/useFlashcardsCollection.ts` (hook: query state + fetch + mutacje)
- `src/components/hooks/useUrlQueryState.ts` (opcjonalnie: generyczny helper do sync z URL)

Wymagane komponenty Shadcn/ui (część może wymagać dodania do `src/components/ui/`, bo obecnie nie wszystkie są w repo):
- **na pewno**: `input`, `select`, `dialog`, `alert-dialog`, `tooltip` (oraz ewentualnie `separator`, `dropdown-menu`).

Wysokopoziomowe drzewo komponentów:

```
src/pages/flashcards.astro
└── Layout.astro
    └── FlashcardsView.tsx
        ├── FlashcardsToolbar.tsx
        │   └── CreateManualFlashcardDialog.tsx
        ├── FlashcardsList.tsx
        │   └── FlashcardCard.tsx (xN)
        │       ├── FlashcardSourceBadge.tsx
        │       ├── FlashcardInlineEditor.tsx (tryb "edit", warunkowo)
        │       └── DeleteFlashcardDialog.tsx (warunkowo)
        └── FlashcardsPagination.tsx
```

## 4. Szczegóły komponentów

### `src/pages/flashcards.astro`
- **Opis komponentu**: strona Astro odpowiedzialna za routing i osadzenie widoku React.
- **Główne elementy**:
  - `Layout.astro`
  - `<FlashcardsView client:load />`
- **Obsługiwane zdarzenia**: brak.
- **Warunki walidacji**: brak.
- **Typy**: brak.
- **Propsy**: brak.

### `FlashcardsView` (`src/components/flashcards/FlashcardsView.tsx`)
- **Opis komponentu**: kontener widoku. Składa toolbar + listę + paginację; odpowiada za stan aplikacyjny (query, dane listy, mutacje, błędy, redirect przy `401`).
- **Główne elementy**:
  - `<main>` + `<h1>` (np. „Moja kolekcja”).
  - Sekcja `toolbar` (landmark: `role="search"` dla wyszukiwarki + filtry).
  - Sekcja listy (`<section aria-busy=...>`).
  - Sekcja paginacji.
  - Region statusów (`aria-live="polite"`) do komunikatów po mutacjach (np. „Zapisano”, „Usunięto”).
- **Obsługiwane zdarzenia**:
  - `onQueryChange(nextQuery)` – zmiana parametrów (search/source/sort/page/pageSize).
  - `onCreateManual()` – zapis nowej fiszki.
  - `onStartEdit(id)` / `onCancelEdit(id)` / `onSaveEdit(id, values)` – edycja inline.
  - `onRequestDelete(id)` / `onConfirmDelete(id)` – usuwanie.
  - `onRetry()` – ponowne pobranie listy.
- **Obsługiwana walidacja** (w UI, przed API):
  - Dla query:
    - `page` musi być liczbą całkowitą `>= 1`.
    - `pageSize` w zakresie `1..100` (API max 100).
    - `search` po `trim()`:
      - jeśli puste → nie wysyłać parametru,
      - jeśli niepuste → `1..200` znaków.
  - Dla mutacji:
    - `front`: `trim()`, `1..200` znaków.
    - `back`: `trim()`, `1..500` znaków.
    - edycja: przynajmniej jedno z pól musi się realnie zmienić (w przeciwnym razie blokada „Zapisz”).
- **Typy**:
  - DTO: `FlashcardListResponse`, `CreateFlashcardsCommand`, `CreateFlashcardsResponse`, `UpdateFlashcardResponse`, `ErrorResponse` (z `src/types.ts`).
  - VM: `FlashcardsQueryVm`, `FlashcardsListVm`, `FlashcardCardVm`, `FlashcardsViewState`, `FlashcardsApiErrorVm`.
- **Propsy**:
  - `returnTo?: string` (domyślnie `"/flashcards"`; używane do redirectów przy `401`).

### `FlashcardsToolbar` (`src/components/flashcards/FlashcardsToolbar.tsx`)
- **Opis komponentu**: zestaw kontrolek do wyszukiwania i filtrowania + sortowania oraz CTA do dodania manualnej fiszki.
- **Główne elementy**:
  - Search input (`Input`) z label (widoczny lub `sr-only`) i opcjonalnym przyciskiem „Wyczyść”.
  - Select „Źródło” (`Select`): `Wszystkie`, `AI`, `AI (edytowane)`, `Manualne`.
  - Select „Sortowanie” (`Select`): mapowane na (`sort`, `order`), np.:
    - „Ostatnio aktualizowane” → `updatedAt desc` (domyślne)
    - „Najnowsze” → `createdAt desc`
    - „Najstarsze” → `createdAt asc`
  - Button „Dodaj nową fiszkę” (otwiera modal).
  - (opcjonalnie) mały opis aktywnych filtrów + „Wyczyść filtry”.
- **Obsługiwane zdarzenia**:
  - `onSearchChange(value)` (debounce ~300–500 ms).
  - `onSourceChange(value | undefined)`.
  - `onSortChange(option)`.
  - `onOpenCreateDialog()`.
  - `onResetFilters()`.
- **Obsługiwana walidacja**:
  - `search` max 200 (blokować wpisywanie po przekroczeniu lub pokazać błąd inline i nie wysyłać do API).
- **Typy**:
  - `FlashcardsQueryVm`, `FlashcardsSortOptionVm`, `FlashcardSourceFilterVm`.
- **Propsy**:
  - `query: FlashcardsQueryVm`
  - `onQueryChange: (next: FlashcardsQueryVm) => void`
  - `onOpenCreate: () => void`
  - `isBusy?: boolean` (np. gdy trwa fetch/mutacja → disable części kontrolek).

### `CreateManualFlashcardDialog` (`src/components/flashcards/CreateManualFlashcardDialog.tsx`)
- **Opis komponentu**: modal (Dialog) z formularzem tworzenia fiszki manualnej.
- **Główne elementy**:
  - `Dialog` + `DialogTitle`/`DialogDescription`.
  - `Textarea` dla `front` i `back` + liczniki znaków (np. `123/200`, `321/500`).
  - Błędy walidacji inline (`aria-describedby`).
  - Przyciski: „Zapisz” i „Anuluj”.
- **Obsługiwane zdarzenia**:
  - `onOpenChange(open)` (Dialog).
  - `onSubmit()` – wywołanie `POST /api/flashcards`.
  - `onCancel()` – zamknięcie modala i reset formularza.
- **Obsługiwana walidacja** (spójna z API):
  - `front.trim().length` w `1..200`
  - `back.trim().length` w `1..500`
- **Typy**:
  - DTO request: `CreateFlashcardsCommand` (z `src/types.ts`).
  - VM: `CreateManualFlashcardFormVm`.
- **Propsy**:
  - `open: boolean`
  - `onOpenChange: (open: boolean) => void`
  - `onCreate: (values: { front: string; back: string }) => Promise<void>`
  - `isSubmitting?: boolean`
- **Uwagi UX/a11y**:
  - Fokus po otwarciu na pole `front`.
  - ESC zamyka, fokus wraca na przycisk wyzwalający (Dialog powinien to zapewnić).
  - Po sukcesie: zamknąć modal i przełączyć listę na `page=1` (żeby nowa fiszka była widoczna przy domyślnym `updatedAt desc`).

### `FlashcardsList` (`src/components/flashcards/FlashcardsList.tsx`)
- **Opis komponentu**: renderuje listę/siatkę fiszek w zależności od stanu (`loading`, `empty`, `error`, `success`).
- **Główne elementy**:
  - wrapper: `<section aria-label="Lista fiszek">`
  - `loading`: skeletony kart.
  - `error`: komunikat z przyciskiem „Spróbuj ponownie”.
  - `empty`:
    - wariant A „brak danych” (brak filtrów i `total===0`) + CTA: „Generuj AI” (`/generate`) i „Dodaj manualnie”.
    - wariant B „brak dopasowań” (aktywne `search` i/lub `source`) + CTA: „Wyczyść filtry”.
  - `success`: `<ul>` lub grid z `FlashcardCard`.
- **Obsługiwane zdarzenia**:
  - `onRetry()`
  - `onStartEdit(id)`
  - `onRequestDelete(id)`
- **Obsługiwana walidacja**: brak (przyjmuje już przygotowane VM).
- **Typy**:
  - `FlashcardsListStateVm` (`status`, `data?`, `error?`)
  - `FlashcardCardVm[]`
- **Propsy**:
  - `state: FlashcardsListStateVm`
  - `onRetry: () => void`
  - `onStartEdit: (id: string) => void`
  - `onRequestDelete: (id: string) => void`
  - `onResetFilters: () => void`

### `FlashcardCard` (`src/components/flashcards/FlashcardCard.tsx`)
- **Opis komponentu**: pojedyncza fiszka w trybie podglądu; zawiera akcje „Edytuj” i „Usuń” oraz wyświetla metadane.
- **Główne elementy**:
  - `Card` z:
    - nagłówkiem: `FlashcardSourceBadge` + daty (`updatedAt`/`createdAt`).
    - treścią: `front` i `back` (np. `line-clamp` + możliwość rozwinięcia w przyszłości).
    - stopką: przyciski „Edytuj”, „Usuń”.
  - Tryb `edit` przełącza się na `FlashcardInlineEditor`.
- **Obsługiwane zdarzenia**:
  - `onEdit()`
  - `onDelete()`
- **Obsługiwana walidacja**: brak.
- **Typy**:
  - `FlashcardCardVm`
- **Propsy**:
  - `item: FlashcardCardVm`
  - `mode: "view" | "edit" | "deleting"`
  - `onStartEdit: (id: string) => void`
  - `onCancelEdit: (id: string) => void`
  - `onSaveEdit: (id: string, values: { front: string; back: string }) => void`
  - `onRequestDelete: (id: string) => void`

### `FlashcardInlineEditor` (`src/components/flashcards/FlashcardInlineEditor.tsx`)
- **Opis komponentu**: edycja fiszki bez opuszczania listy (textarea dla `front` i `back`).
- **Główne elementy**:
  - `Textarea` dla `front` i `back` z licznikami znaków.
  - Komunikat dot. źródła (jeśli `source==="ai"`): „Edycja oznaczy fiszkę jako AI (edytowana).”
  - Przyciski: „Zapisz” (primary) i „Anuluj”.
  - Inline error (np. pod polami).
- **Obsługiwane zdarzenia**:
  - `onChangeFront`, `onChangeBack`
  - `onSave()`
  - `onCancel()`
- **Obsługiwana walidacja**:
  - `front.trim()` w `1..200`, `back.trim()` w `1..500`
  - `isDirty` (blokada „Zapisz” jeśli brak realnych zmian)
- **Typy**:
  - `FlashcardEditDraftVm`
- **Propsy**:
  - `initial: { front: string; back: string; source: FlashcardSource }`
  - `isSaving?: boolean`
  - `onSave: (values: { front: string; back: string }) => Promise<void>`
  - `onCancel: () => void`

### `DeleteFlashcardDialog` (`src/components/flashcards/DeleteFlashcardDialog.tsx`)
- **Opis komponentu**: dialog potwierdzający usunięcie (AlertDialog).
- **Główne elementy**:
  - `AlertDialog` z ostrzeżeniem o nieodwracalności.
  - Krótki podgląd `front`/`back` (np. 1–2 linie).
  - Przyciski: „Usuń” (destructive) i „Anuluj”.
- **Obsługiwane zdarzenia**:
  - `onConfirm()` – `DELETE /api/flashcards/{id}`
  - `onCancel()`
- **Obsługiwana walidacja**: brak.
- **Typy**:
  - `FlashcardCardVm` (do wyświetlenia skrótu treści)
- **Propsy**:
  - `open: boolean`
  - `item: Pick<FlashcardCardVm, "id" | "front" | "back">`
  - `onOpenChange: (open: boolean) => void`
  - `onConfirm: (id: string) => Promise<void>`
  - `isPending?: boolean`
- **Uwagi**:
  - `404` z delete traktować jako „już usunięto” (zamknąć dialog i odświeżyć listę).

### `FlashcardSourceBadge` (`src/components/flashcards/FlashcardSourceBadge.tsx`)
- **Opis komponentu**: prezentacja źródła fiszki z ikoną i tooltipem.
- **Główne elementy**:
  - `Badge` + ikonka (np. `Sparkles` dla AI, `Sparkles`+`Pencil` dla AI-edited, `Hand` dla manual).
  - `Tooltip` z opisem:
    - `ai` → „Wygenerowana przez AI”
    - `ai-edited` → „Wygenerowana przez AI i edytowana”
    - `manual` → „Stworzona manualnie”
- **Obsługiwane zdarzenia**: hover/focus tooltip.
- **Obsługiwana walidacja**: brak.
- **Typy**:
  - `FlashcardSource` (z `src/types.ts`)
  - `FlashcardSourceBadgeVm` (opcjonalnie, jeśli mapujemy label/tooltip w `types.ts`)
- **Propsy**:
  - `source: FlashcardSource`

### `FlashcardsPagination` (`src/components/flashcards/FlashcardsPagination.tsx`)
- **Opis komponentu**: kontrola paginacji listy.
- **Główne elementy**:
  - „Poprzednia” / „Następna”
  - Tekst: „Strona X z Y” + (opcjonalnie) select `pageSize` (20/50/100).
- **Obsługiwane zdarzenia**:
  - `onPageChange(page)`
  - `onPageSizeChange(pageSize)` (reset do `page=1`)
- **Obsługiwana walidacja**:
  - nie pozwala zejść poniżej 1 ani powyżej `totalPages`.
- **Typy**:
  - `FlashcardsQueryVm`, `FlashcardsPaginationVm`
- **Propsy**:
  - `page: number`
  - `totalPages: number`
  - `pageSize: number`
  - `total: number`
  - `onPageChange: (page: number) => void`
  - `onPageSizeChange: (pageSize: number) => void`
  - `disabled?: boolean`

## 5. Typy

### DTO (istniejące, `src/types.ts`)
- `FlashcardSource`
- `FlashcardDto`
- `FlashcardListQuery`
- `FlashcardListResponse` (`PaginatedResponse<FlashcardDto>`)
- `CreateFlashcardsCommand`
- `CreateFlashcardsResponse`
- `UpdateFlashcardCommand` (Uwaga: w praktyce backend PUT wymaga też `source` w body – patrz niżej)
- `UpdateFlashcardResponse`
- `ErrorResponse`

### Nowe typy ViewModel (rekomendacja: `src/components/flashcards/types.ts`)

#### `type FlashcardsViewStatus = "idle" | "loading" | "success" | "empty" | "error"`

#### `type FlashcardsSortOptionVm = "updated_desc" | "created_desc" | "created_asc"`
- Mapowanie:
  - `updated_desc` → `sort="updatedAt"`, `order="desc"`
  - `created_desc` → `sort="createdAt"`, `order="desc"`
  - `created_asc` → `sort="createdAt"`, `order="asc"`

#### `type FlashcardSourceFilterVm = "all" | FlashcardSource`

#### `interface FlashcardsQueryVm`
- `page: number`
- `pageSize: number`
- `sort: "createdAt" | "updatedAt"`
- `order: "asc" | "desc"`
- `source?: FlashcardSource`
- `search?: string`

#### `interface FlashcardsListVm`
- `items: FlashcardCardVm[]`
- `page: number`
- `pageSize: number`
- `total: number`
- `totalPages: number`

#### `interface FlashcardCardVm`
- `id: string`
- `front: string`
- `back: string`
- `source: FlashcardSource`
- `createdAt: string`
- `updatedAt: string`
- `createdAtLabel: string` (np. `toLocaleString("pl-PL")`)
- `updatedAtLabel: string`

#### `interface FlashcardsApiErrorVm`
- `kind: "unauthorized" | "validation" | "not_found" | "network" | "timeout" | "server" | "unknown"`
- `status?: number`
- `code?: string`
- `message: string`
- `canRetry: boolean`
- `action?: { type: "link"; href: string; label: string }`

#### `interface FlashcardsListStateVm`
- `status: FlashcardsViewStatus`
- `data?: FlashcardsListVm`
- `error?: FlashcardsApiErrorVm`
- `emptyKind?: "no_data" | "no_matches"`

#### `interface FlashcardEditDraftVm`
- `front: string`
- `back: string`
- `frontError?: string`
- `backError?: string`
- `isDirty: boolean`
- `isValid: boolean`

#### Helpery mapujące
- `parseFlashcardsQueryFromUrl(search: string): FlashcardsQueryVm`
- `toUrlSearchParams(query: FlashcardsQueryVm): string`
- `mapFlashcardDtoToCardVm(dto: FlashcardDto): FlashcardCardVm`
- `computeTotalPages(total: number, pageSize: number): number`

### Uwaga o niespójności PUT (ważne dla implementacji)
W `src/pages/api/flashcards/[id].ts` backend waliduje body przez `updateFlashcardPayloadSchema`, które obecnie **wymaga pola `source`** w payloadzie.
- **Docelowo** (rekomendacja): dopasować backend do kontraktu z opisu endpointu i zmienić walidację na `{ front?, back? }` bez wymaganego `source`.
- **Tymczasowo (front)**: wysyłać `source` z aktualnej fiszki w body PUT, mimo że serwis go ignoruje. W praktyce oznacza to lokalny typ payloadu:
  - `type UpdateFlashcardPayload = { front?: string; back?: string; source: FlashcardSource }`

## 6. Zarządzanie stanem
Rekomendacja: lokalny stan w `FlashcardsView` oparty o custom hook `useFlashcardsCollection()` (zgodnie z regułą: hooki w `src/components/hooks`).

### Hook: `useFlashcardsCollection(returnTo = "/flashcards")`
Odpowiedzialności:
- **Źródło prawdy query**: stan `query` synchronizowany z `window.location.search` (pushState/replaceState).
- **Pobieranie listy** przy każdej zmianie query (z anulowaniem poprzednich requestów):
  - `listState: FlashcardsListStateVm`
  - `refetch()`
- **Mutacje**:
  - `createManual(front, back)` → po sukcesie: `setQuery({ ...query, page: 1, sort: "updatedAt", order: "desc" })` + `refetch()`
  - `updateFlashcard(id, values)` → lokalnie zamknąć edycję + `refetch()` (lub aktualizacja lokalna + opcjonalny `refetch` w tle)
  - `deleteFlashcard(id)` → `refetch()`; jeśli `404` → traktować jak sukces
- **UI state**:
  - `createDialogOpen: boolean`
  - `editingId: string | null`
  - `deleteTargetId: string | null`
  - `mutationState`: np. `isCreating`, `isUpdatingById`, `isDeletingById`
- **Obsługa `401`**: centralnie w `api.ts` (redirect + przerwanie) lub w hooku.

Wskazówki React/perf:
- `useCallback` dla handlerów przekazywanych do dzieci.
- Debounce wyszukiwania (np. `setTimeout` + cleanup w `useEffect`).
- `AbortController` dla listy przy szybkich zmianach query.

## 7. Integracja API
Wszystkie wywołania idą do ścieżek Astro API: `/api/flashcards`.

### 7.1 `GET /api/flashcards`
**Cel**: pobranie stronicowanej listy zgodnie z parametrami.
- **Query** (zgodne z walidacją backendu `flashcardListQuerySchema`):
  - `page` (default 1, min 1)
  - `pageSize` (default 20, max 100)
  - `sort=createdAt|updatedAt`
  - `order=desc|asc`
  - `source=ai|ai-edited|manual` (opcjonalnie)
  - `search` (opcjonalnie, `trim`, `1..200`)
- **Response 200**: `FlashcardListResponse`
- **Obsługa**:
  - `401` → `window.location.href = "/auth/login?returnTo=/flashcards"`
  - `400` → błąd walidacji query (pokazać „Nieprawidłowe parametry” + retry)
  - `>=500` → „Błąd serwera” + retry
  - `network/timeout` → „Problem z połączeniem” + retry

### 7.2 `POST /api/flashcards` (manual)
**Request**: `CreateFlashcardsCommand`

```json
{ "flashcards": [ { "front": "...", "back": "...", "source": "manual", "generationId": null } ] }
```

**Response 201**: `CreateFlashcardsResponse` (zwraca `created[]` z `id` itd.)
- **Obsługa**:
  - `400` → pokazać błąd w modalu (inline)
  - `401` → redirect do logowania
  - `500` → komunikat + możliwość ponowienia

### 7.3 `PUT /api/flashcards/{id}`
**Request**:
- docelowo wg opisu endpointu: `{ front?: string, back?: string }`
- **tymczasowo** (zgodnie z obecną walidacją backendu): `{ front?: string, back?: string, source: FlashcardSource }`
**Response 200**: `UpdateFlashcardResponse` (`id`, `source`, `updatedAt`)
- **Obsługa**:
  - `404` → „Nie znaleziono fiszki” (np. usunięta w innej karcie) + odświeżyć listę
  - `400` → błąd walidacji (pokazać inline w edytorze)
  - `401` → redirect
  - `500` → błąd + retry
- **Ważne**: UI nie ustawia `source` na własną rękę; backend sam ustawia `ai → ai-edited` jeśli treść się zmieni.

### 7.4 `DELETE /api/flashcards/{id}`
**Uwaga**: endpoint `DELETE` nie jest widoczny w aktualnej implementacji `src/pages/api/flashcards/[id].ts`. Widok wymaga jego istnienia (FR-04.4 / US-016).
- **Response 204**: brak body
- **Obsługa**:
  - `404` → traktować jako „już usunięto” + odświeżyć listę
  - `401` → redirect
  - `500` → błąd + retry

## 8. Interakcje użytkownika
- **Wejście na `/flashcards`**:
  - widok odczytuje query z URL i pobiera listę.
  - domyślne parametry (jeśli brak w URL): `page=1&pageSize=20&sort=updatedAt&order=desc`.
- **Wyszukiwanie**:
  - wpisywanie w input → debounce → aktualizacja `search` w URL → fetch listy.
  - wyczyszczenie inputu → usunięcie `search` z URL → fetch listy.
- **Filtr źródła**:
  - wybór `AI/AI-edited/Manual` → ustawienie `source` w URL i reset `page=1` → fetch.
  - wybór `Wszystkie` → usunięcie `source` z URL → fetch.
- **Sortowanie**:
  - zmiana opcji sort → ustawienie `sort`/`order` i reset `page=1` → fetch.
- **Paginacja**:
  - klik „Następna/Poprzednia” → zmiana `page` w URL → fetch.
  - zmiana `pageSize` → `page=1` → fetch.
- **Dodanie manualnej fiszki**:
  - klik „Dodaj nową fiszkę” → otwarcie modala (fokus na `front`).
  - „Zapisz” → walidacja client-side → POST → po sukcesie:
    - zamknięcie modala,
    - przejście/ustawienie na `page=1` i domyślne sortowanie,
    - odświeżenie listy,
    - komunikat w `aria-live`: „Dodano fiszkę”.
- **Edycja fiszki (inline)**:
  - klik „Edytuj” → karta przechodzi w tryb edycji (fokus na `front`).
  - „Zapisz”:
    - zablokowane, jeśli brak zmian lub walidacja nie przechodzi,
    - PUT → po sukcesie: wyjście z edycji + odświeżenie listy + komunikat „Zapisano zmiany”.
  - „Anuluj” → wyjście z edycji bez requestu.
- **Usuwanie fiszki**:
  - klik „Usuń” → AlertDialog z potwierdzeniem.
  - „Usuń” → DELETE → po sukcesie/404: zamknąć dialog + odświeżyć listę + komunikat „Usunięto fiszkę”.

## 9. Warunki i walidacja
Warunki wynikające z backendu (Zod w `src/lib/validation/flashcards.ts`) i sposób egzekwowania w UI:

### 9.1 Lista (`GET /flashcards`)
- `page`: `int >= 1`
- `pageSize`: `int 1..100` (UI udostępnia np. 20/50/100)
- `sort`: `"createdAt" | "updatedAt"`
- `order`: `"desc" | "asc"`
- `source` (opcjonalnie): `"ai" | "ai-edited" | "manual"`
- `search` (opcjonalnie):
  - UI zawsze `trim()`
  - jeśli wynik `""` → nie wysyłać parametru
  - jeśli niepusty → `1..200`

### 9.2 Dodawanie manualne (`POST /flashcards`)
- `front`: `trim()`, `1..200`
- `back`: `trim()`, `1..500`
- `source`: zawsze `"manual"`
- `generationId`: `null` (lub brak; dla spójności wysyłać `null`)

### 9.3 Edycja (`PUT /flashcards/{id}`)
- Przynajmniej jedno z pól musi zostać wysłane i realnie się różnić od wartości początkowej.
- `front`/`back` jak wyżej.
- Konsekwencja `source`:
  - UI pokazuje informację o zmianie źródła (AI → AI-edited), ale **nie wymusza** jej lokalnie.

### 9.4 Paginacja out-of-range
Jeśli backend zwróci:
- `items.length === 0` oraz `total > 0` (np. użytkownik jest na stronie, która już nie istnieje po usunięciu/filtrze),
to UI powinno:
- wyliczyć `lastPage = max(1, ceil(total / pageSize))`,
- ustawić `page = lastPage` i ponowić fetch (jednorazowo, z zabezpieczeniem przed pętlą).

## 10. Obsługa błędów
Scenariusze i zalecane reakcje UI:
- **401 Unauthorized** (każdy endpoint): natychmiastowy redirect do `/auth/login?returnTo=/flashcards`.
- **400 Bad Request**:
  - GET list: pokazać błąd ogólny „Nieprawidłowe parametry” + przycisk retry (i/lub „Wyczyść filtry”).
  - POST/PUT: pokazać błąd inline przy polach (jeśli backend zwraca tylko `message`, użyć go jako tekstu ogólnego w formularzu).
- **404 Not Found**:
  - PUT: pokazać „Nie znaleziono fiszki” + odświeżyć listę (wyjść z edycji).
  - DELETE: traktować jako sukces („już usunięto”) + odświeżyć listę.
- **500+ / server_error**: pokazać komunikat + retry.
- **Network/timeout (AbortError)**: komunikat „Problem z połączeniem…” + retry.

Wymagania a11y:
- komunikaty błędów w komponentach listy/dialogów powinny używać `role="alert"`.
- komunikaty sukcesu w `aria-live="polite"`.
- poprawne focus management w dialogach i po akcjach.

## 11. Kroki implementacji
1. **Dodać routing**:
   - utworzyć `src/pages/flashcards.astro` na wzór `dashboard.astro` / `generate.astro` i zamontować `FlashcardsView client:load`.
2. **Dodać brakujące komponenty UI (shadcn/ui)**:
   - wygenerować/dodać do `src/components/ui/`: `input`, `select`, `dialog`, `alert-dialog`, `tooltip` (oraz ewentualnie `separator`, `dropdown-menu`).
3. **Zdefiniować typy ViewModel**:
   - utworzyć `src/components/flashcards/types.ts` i zaimplementować VM + helpery do mapowania i serializacji query.
4. **Zaimplementować warstwę API dla widoku**:
   - utworzyć `src/components/flashcards/api.ts`:
     - `fetchWithTimeout` (analogicznie do `dashboard/api.ts` i `generate/api.ts`)
     - `getFlashcards(query): Promise<FlashcardsListVm>`
     - `createManualFlashcard(front, back): Promise<void>`
     - `updateFlashcard(id, payload): Promise<UpdateFlashcardResponse>`
     - `deleteFlashcard(id): Promise<void>`
     - mapowanie błędów na `FlashcardsApiErrorVm` + obsługa `401` redirect
5. **Zaimplementować hook**:
   - utworzyć `src/components/hooks/useFlashcardsCollection.ts`:
     - parsowanie URL → `query`
     - debounce `search`
     - fetch listy z abort/cancel
     - mutacje + refetch
     - kontrola `editingId`, `createDialogOpen`, `deleteTargetId`
6. **Zaimplementować komponenty widoku**:
   - `FlashcardsView` (spina wszystko)
   - `FlashcardsToolbar` (kontrolki)
   - `FlashcardsList` (stany + render listy)
   - `FlashcardCard` + `FlashcardSourceBadge` + `FlashcardInlineEditor`
   - `CreateManualFlashcardDialog`, `DeleteFlashcardDialog`
   - `FlashcardsPagination`
7. **Zweryfikować zgodność z API i doprecyzować PUT/DELETE**:
   - jeśli backend nadal wymaga `source` w PUT → dodać to pole w payloadzie tymczasowo (zgodnie z sekcją 5).
   - potwierdzić dostępność endpointu DELETE; jeśli brak, wdrożyć go po stronie backendu przed spięciem UI.
8. **Test plan (manualny)**:
   - Wejście na `/flashcards` z pustą kolekcją → empty state „brak danych” + CTA.
   - Dodanie manualne → nowa fiszka widoczna na liście (page=1, `updatedAt desc`).
   - Wyszukiwanie: brak dopasowań → empty state „brak dopasowań” + „Wyczyść filtry”.
   - Filtr `source` działa i jest odzwierciedlany w URL.
   - Sortowanie działa i jest odzwierciedlane w URL.
   - Paginacja działa; edge: po usunięciu ostatniej pozycji na stronie → korekta `page`.
   - Edycja AI → po zmianie treści badge zmienia się na „AI (edytowana)” po odświeżeniu (zgodnie z backendem).
   - Usuwanie: `204` usuwa element; `404` traktowane jak sukces.
   - Symulacja `401` (np. przez mock) → redirect do `/auth/login?returnTo=/flashcards`.

