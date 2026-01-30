# Plan implementacji widoku Konto (`/account`)

## 1. Przegląd
Widok **Konto** pod ścieżką `/account` służy do:
- **zarządzania sesją** (prezentacja e-mail, wylogowanie),
- **diagnostyki limitu generowań** (quota: `remaining`, `limit`, `resetsAtUtc`),
- **diagnostyki historii generowań** (lista z filtrem statusu, sortowaniem i paginacją) oraz podglądu szczegółów generacji w dialogu.

Powiązania z PRD / User Stories:
- **FR-01.4 / US-005**: widoczny przycisk „Wyloguj”, zakończenie sesji, przekierowanie do logowania.
- **FR-02.5 / US-009**: widoczny limit dzienny, komunikat o odnowieniu limitu (czas resetu pokazany w lokalnej strefie czasowej).
- Wsparcie diagnostyki: użytkownik widzi statusy generowań i (dla `failed`) kod/komunikat błędu.

Założenia zgodne z istniejącym kodem:
- Endpointy są dostępne pod prefiksem **`/api`**:
  - `GET /api/generations/quota`
  - `GET /api/generations?status=&page=&pageSize=&sort=&order=`
  - (dla dialogu szczegółów) `GET /api/generations/{id}` – endpoint już istnieje w repo.
- Autoryzacja jest oparta o cookies Supabase (fetch `credentials: "same-origin"`).
- `401` ma skutkować przekierowaniem do logowania (z `returnTo=/account`).

## 2. Routing widoku
- **Ścieżka widoku**: `/account`
- **Plik routingu**: `src/pages/account.astro`
- **Mount React**: `<AccountView client:load />`
- **Layout**: użyć `src/layouts/Layout.astro` (Topbar jest renderowany automatycznie dla tras innych niż `/` i `/auth/*`).

Ważne (ochrona trasy):
- Aktualnie `src/middleware/index.ts` chroni m.in. `/dashboard`, `/generate`, `/flashcards` i `/api/generations`, ale **nie chroni `/account`**.
- W ramach wdrożenia należy dopisać `/account` do `PROTECTED_PREFIXES`, aby:
  - wejście na `/account` bez sesji robiło redirect do `/auth/login?returnTo=/account`,
  - każde `401` z API było spójne (middleware dla `/api/*` zwraca JSON 401).

## 3. Struktura komponentów
Rekomendowana struktura plików:
- `src/pages/account.astro` (routing + layout + mount React)
- `src/components/account/AccountView.tsx` (kontener widoku, spina sekcje i fetch)
- `src/components/account/ProfileSection.tsx` (email + logout)
- `src/components/account/QuotaCard.tsx` (quota + opis resetu)
- `src/components/account/GenerationsHistorySection.tsx` (sekcja historii: filtry + tabela + paginacja)
- `src/components/account/GenerationsFilters.tsx` (status + sort + pageSize)
- `src/components/account/GenerationsTable.tsx` (tabela/lista generowań + akcja „szczegóły”)
- `src/components/account/GenerationsPagination.tsx` (paginacja)
- `src/components/account/GenerationDetailsDialog.tsx` (dialog szczegółów generacji)
- `src/components/account/api.ts` (wywołania API + mapowanie błędów)
- `src/components/account/types.ts` (ViewModele i helpery mapujące DTO → VM)
- `src/components/hooks/useGenerationsHistory.ts` (hook: stan query + fetch + URL sync)
- (opcjonalnie) `src/components/hooks/useGenerationQuota.ts` (hook: quota + odświeżanie)

Wysokopoziomowe drzewo komponentów:

```
src/pages/account.astro
└── Layout.astro
    └── AccountView.tsx
        ├── ProfileSection.tsx
        ├── QuotaCard.tsx
        └── GenerationsHistorySection.tsx
            ├── GenerationsFilters.tsx
            ├── GenerationsTable.tsx
            │   └── GenerationDetailsDialog.tsx (warunkowo, po kliknięciu „szczegóły”)
            └── GenerationsPagination.tsx
```

## 4. Szczegóły komponentów

### `src/pages/account.astro`
- **Opis komponentu**: strona Astro odpowiedzialna za routing i osadzenie widoku React.
- **Główne elementy**:
  - `Layout.astro`
  - `<AccountView client:load />`
- **Obsługiwane zdarzenia**: brak.
- **Warunki walidacji**: brak.
- **Typy**: brak.
- **Propsy**: brak.

### `AccountView` (`src/components/account/AccountView.tsx`)
- **Opis komponentu**: główny kontener widoku. Renderuje nagłówek, sekcję profilu, quota oraz historię generowań. Koordynuje pobieranie quota i deleguje historię do hooka/sekcji.
- **Główne elementy**:
  - `<main>` + `<h1>` (np. „Konto”)
  - układ sekcji (np. `grid gap-4 md:grid-cols-2` dla profilu + quota, a historia w pełnej szerokości)
  - dzieci: `ProfileSection`, `QuotaCard`, `GenerationsHistorySection`
  - region komunikatów (np. `aria-live="polite"`) dla informacji typu „Odświeżono”.
- **Obsługiwane zdarzenia**:
  - `onRefreshQuota()` (retry quota)
  - `onRefreshHistory()` (retry listy generowań – przez hook)
- **Warunki walidacji**:
  - `returnTo` dla redirectów przy `401` powinno być stałe: `"/account"`.
  - quota i historia nie powinny blokować się wzajemnie (niezależne stany `loading/error`).
- **Typy (DTO i ViewModel)**:
  - DTO: `GenerationQuotaResponse`, `ErrorResponse` (z `src/types.ts`)
  - VM: `QuotaStateVm`, `AccountApiErrorVm`
- **Propsy**:
  - `returnTo?: string` (domyślnie `"/account"`)

### `ProfileSection` (`src/components/account/ProfileSection.tsx`)
- **Opis komponentu**: sekcja profilu użytkownika: email i przycisk „Wyloguj”.
- **Główne elementy**:
  - `Card` (shadcn) z nagłówkiem „Profil”
  - pole tekstowe/wiersz: „Email: …”
  - przycisk „Wyloguj”:
    - preferowane: `<form method="post" action="/api/auth/logout">` + `Button` (spójne z `Topbar.astro`)
- **Obsługiwane zdarzenia**:
  - submit formularza wylogowania (POST).
- **Warunki walidacji**:
  - brak (to akcja serwerowa).
- **Typy**:
  - `ProfileVm` (np. `email: string | null`)
- **Propsy**:
  - `email?: string | null`

### `QuotaCard` (`src/components/account/QuotaCard.tsx`)
- **Opis komponentu**: prezentuje dzienny limit generowania (`remaining`, `limit`) oraz czas resetu. Powinna działać także jako element diagnostyczny.
- **Główne elementy**:
  - `Card` z nagłówkiem „Limit generowania”
  - `Badge`/licznik: „Pozostało: X / Y”
  - tekst pomocniczy: „Limit odnowi się: {localDateTime}” + (opcjonalnie) tooltip z oryginalnym UTC
  - stany:
    - `loading`: `Skeleton`
    - `error`: komunikat + przycisk „Spróbuj ponownie”
- **Obsługiwane zdarzenia**:
  - `onRetry()` dla błędu pobrania quota.
- **Warunki walidacji** (wynikające z API):
  - `remaining` i `limit` traktować jako `>= 0` (UI nie wymusza, ale nie powinien wyświetlać wartości ujemnych).
  - `resetsAtUtc` musi parsować się do `Date`:
    - jeśli parsowanie się nie powiedzie → pokazać fallback „Nieznany czas resetu”.
- **Typy**:
  - DTO: `GenerationQuotaResponse` (`DailyLimitDto`)
  - VM: `QuotaVm`:
    - `remaining: number`
    - `limit: number`
    - `resetsAtUtc: string`
    - `resetsAtLocalLabel: string`
    - `isExhausted: boolean` (gdy `remaining === 0`)
- **Propsy**:
  - `state: QuotaStateVm` (np. `loading/success/error`)
  - `onRetry: () => void`

### `GenerationsHistorySection` (`src/components/account/GenerationsHistorySection.tsx`)
- **Opis komponentu**: sekcja historii generowań. Składa filtry, tabelę/listę i paginację; spina się z hookiem `useGenerationsHistory`.
- **Główne elementy**:
  - `<section aria-label="Historia generowań">`
  - `GenerationsFilters`
  - `GenerationsTable`
  - `GenerationsPagination`
  - `loading`: skeleton dla tabeli
  - `empty`:
    - wariant „brak danych” (total=0) + CTA do `/generate`
    - wariant „brak dopasowań” (aktywny filtr statusu) + CTA „Wyczyść filtry”
  - `error`: komunikat + retry
- **Obsługiwane zdarzenia**:
  - `onQueryChange(nextQuery)` (zmiana status/sort/order/page/pageSize)
  - `onRetry()` (ponowny fetch listy)
  - `onOpenDetails(id)` (otwarcie dialogu szczegółów)
- **Warunki walidacji**:
  - query musi być zgodne z backendowym Zod:
    - `status` ∈ `{pending,succeeded,failed}` lub brak
    - `page` int `>= 1`
    - `pageSize` int `1..100` (default 20)
    - `sort` ∈ `{createdAt, finishedAt}` (default createdAt)
    - `order` ∈ `{desc, asc}` (default desc)
  - korekta `page` jeśli out-of-range (analogicznie do `useFlashcardsCollection`):
    - gdy `items.length === 0`, `total > 0` i `page > totalPages` → ustawić `page=totalPages` i ponowić fetch jednorazowo.
- **Typy**:
  - DTO: `GenerationListResponse`, `GenerationListQuery`, `ErrorResponse`
  - VM: `GenerationsHistoryStateVm`, `GenerationsListVm`, `GenerationsQueryVm`
- **Propsy**:
  - `returnTo?: string` (domyślnie `"/account"`)

### `GenerationsFilters` (`src/components/account/GenerationsFilters.tsx`)
- **Opis komponentu**: kontrolki filtrowania/sortowania historii (status, sort, order, pageSize).
- **Główne elementy**:
  - `Select` statusu:
    - „Wszystkie” (brak `status`)
    - „W trakcie” → `pending`
    - „Sukces” → `succeeded`
    - „Błąd” → `failed`
  - `Select` sortowania:
    - „Data utworzenia” → `sort=createdAt`
    - „Data zakończenia” → `sort=finishedAt`
  - `Select` kolejności:
    - „Najnowsze” → `order=desc`
    - „Najstarsze” → `order=asc`
  - `Select` `pageSize`: np. 20 / 50 / 100
  - przycisk „Wyczyść” (reset do domyślnego query)
- **Obsługiwane zdarzenia**:
  - `onStatusChange(value)`
  - `onSortChange(value)`
  - `onOrderChange(value)`
  - `onPageSizeChange(value)` (resetuje `page=1`)
  - `onReset()` (reset query)
- **Warunki walidacji**:
  - `pageSize` zawsze w `1..100` (UI wystawia tylko dozwolone opcje).
  - `status` wysyłamy tylko gdy != „Wszystkie”.
- **Typy**:
  - `GenerationStatusFilterVm`, `GenerationsSortVm`, `GenerationsOrderVm`, `GenerationsQueryVm`
- **Propsy**:
  - `query: GenerationsQueryVm`
  - `onQueryChange: (next: GenerationsQueryVm) => void`
  - `disabled?: boolean` (gdy trwa fetch)

### `GenerationsTable` (`src/components/account/GenerationsTable.tsx`)
- **Opis komponentu**: semantyczna tabela (lub lista) generowań. Każdy wiersz pokazuje status, daty i skrót diagnostyczny oraz akcję „Szczegóły”.
- **Główne elementy**:
  - `<table>` z `<thead>` i `<tbody>` (a11y: poprawne nagłówki kolumn)
  - kolumny (rekomendacja):
    - Status (`Badge`)
    - Utworzono (lokalna data/czas)
    - Zakończono (lokalna data/czas lub „—” dla `pending`)
    - Wygenerowano / zaakceptowano (np. `generatedCount`, `acceptedOriginalCount+acceptedEditedCount`)
    - Błąd (tylko dla `failed`: `error.code` + skrót `error.message`)
    - Akcja: ikonka „Szczegóły” (np. `lucide-react` `Info`/`Eye`)
  - stany: `loading` (skeleton rows), `empty`, `error` – te stany mogą być wyżej w sekcji, tabela dostaje już dane.
- **Obsługiwane zdarzenia**:
  - klik w ikonę „Szczegóły” → `onOpenDetails(id)`
- **Warunki walidacji**:
  - `id` musi być UUID (UI nie waliduje ręcznie, bo pochodzi z API; przy manualnym wpisie w URL dialogu – jeśli wprowadzimy – walidować).
- **Typy**:
  - DTO: `GenerationDto`, `GenerationStatus`
  - VM: `GenerationRowVm`
- **Propsy**:
  - `items: GenerationRowVm[]`
  - `onOpenDetails: (id: string) => void`

### `GenerationsPagination` (`src/components/account/GenerationsPagination.tsx`)
- **Opis komponentu**: kontrola paginacji historii (prev/next + informacja o stronach), opcjonalnie szybki skok.
- **Główne elementy**:
  - przyciski „Poprzednia” / „Następna”
  - tekst: „Strona X z Y” (z `totalPages`)
- **Obsługiwane zdarzenia**:
  - `onPageChange(page)` (increment/decrement)
- **Warunki walidacji**:
  - nie pozwala zejść poniżej 1 ani powyżej `totalPages`
- **Typy**:
  - `GenerationsPaginationVm`
- **Propsy**:
  - `page: number`
  - `totalPages: number`
  - `total: number`
  - `onPageChange: (page: number) => void`
  - `disabled?: boolean`

### `GenerationDetailsDialog` (`src/components/account/GenerationDetailsDialog.tsx`)
- **Opis komponentu**: dialog pokazujący szczegóły generacji po kliknięciu ikony szczegółów.
- **Strategia danych (rekomendacja)**:
  - Na otwarcie dialogu wykonać `GET /api/generations/{id}`:
    - zapewnia spójność i pełny refresh danych (np. gdy status się zmienił).
  - (Fallback) Jeśli fetch zawiedzie, można pokazać dane z listy jako „ostatnio znane” + błąd odświeżenia.
- **Główne elementy**:
  - `Dialog` (shadcn) + `DialogContent`
  - pola szczegółów (definition list lub grid):
    - `id`
    - `status`
    - `createdAt` (lokalnie)
    - `finishedAt` (lokalnie lub „—”)
    - `generatedCount`
    - `acceptedOriginalCount`, `acceptedEditedCount`
    - `error.code`, `error.message` (tylko gdy `failed`)
  - `Skeleton` w trakcie ładowania
  - przycisk zamknięcia (Dialog zapewnia)
- **Obsługiwane zdarzenia**:
  - `onOpenChange(open)` (zamykanie)
  - `onRetry()` (ponów pobranie szczegółu po błędzie)
- **Warunki walidacji**:
  - `id` wysyłane do API musi być poprawnym UUID (w praktyce pochodzi z listy).
- **Typy**:
  - DTO: `GenerationDetailResponse`
  - VM: `GenerationDetailStateVm`, `AccountApiErrorVm`
- **Propsy**:
  - `open: boolean`
  - `generationId: string | null`
  - `onOpenChange: (open: boolean) => void`
  - `returnTo?: string` (domyślnie `"/account"`)

## 5. Typy

### DTO (istniejące, `src/types.ts`)
- `TimestampString`
- `ErrorResponse`
- `DailyLimitDto` / `GenerationQuotaResponse`
- `GenerationStatus` (w praktyce backend dopuszcza: `pending|succeeded|failed`)
- `GenerationDto`
- `GenerationListQuery`
- `GenerationListResponse` (`PaginatedResponse<GenerationDto>`)
- `GenerationDetailResponse` (= `GenerationDto`)

### Nowe typy ViewModel (rekomendacja: `src/components/account/types.ts`)

#### Query / filtry
```ts
export type GenerationStatusFilterVm = "all" | "pending" | "succeeded" | "failed";
export type GenerationsSortVm = "createdAt" | "finishedAt";
export type GenerationsOrderVm = "desc" | "asc";

export interface GenerationsQueryVm {
  status: GenerationStatusFilterVm; // "all" oznacza brak parametru status w API
  page: number;
  pageSize: number; // 1..100
  sort: GenerationsSortVm; // default createdAt
  order: GenerationsOrderVm; // default desc
}
```

#### Lista i paginacja
```ts
export interface GenerationRowVm {
  id: string;
  status: "pending" | "succeeded" | "failed";
  createdAt: string;
  createdAtLabel: string;
  finishedAt: string | null;
  finishedAtLabel: string; // "—" gdy null
  generatedCount: number | null;
  acceptedTotalCount: number; // acceptedOriginalCount + acceptedEditedCount
  acceptedOriginalCount: number | null;
  acceptedEditedCount: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  errorMessageShort: string | null; // np. ucięte do 80-120 znaków
}

export interface GenerationsListVm {
  items: GenerationRowVm[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
```

#### Quota
```ts
export interface QuotaVm {
  remaining: number;
  limit: number;
  resetsAtUtc: string;
  resetsAtLocalLabel: string;
  isExhausted: boolean;
}
```

#### Stany asynchroniczne i błędy
```ts
export type AsyncStatus = "idle" | "loading" | "success" | "empty" | "error";

export interface AccountApiErrorVm {
  kind: "unauthorized" | "validation" | "not_found" | "network" | "timeout" | "server" | "unknown";
  status?: number;
  code?: string;
  message: string;
  canRetry: boolean;
  action?: { type: "link"; href: string; label: string };
}

export interface QuotaStateVm {
  status: "idle" | "loading" | "success" | "error";
  data?: QuotaVm;
  error?: AccountApiErrorVm;
}

export interface GenerationsHistoryStateVm {
  status: AsyncStatus;
  data?: GenerationsListVm;
  error?: AccountApiErrorVm;
  emptyKind?: "no_data" | "no_matches";
}

export interface GenerationDetailStateVm {
  status: "idle" | "loading" | "success" | "error";
  data?: GenerationRowVm; // albo osobny VM detaliczny, jeśli chcemy różnicować
  error?: AccountApiErrorVm;
}
```

#### Helpery mapujące i formatowanie
W `src/components/account/types.ts` warto dodać:
- `parseGenerationsQueryFromUrl(search: string): GenerationsQueryVm`
- `toUrlSearchParams(query: GenerationsQueryVm): string`
- `normalizeQuery(query: GenerationsQueryVm): GenerationsQueryVm` (clamp page/pageSize)
- `computeTotalPages(total: number, pageSize: number): number`
- `mapGenerationDtoToRowVm(dto: GenerationDto): GenerationRowVm`
- `formatLocalDateTime(isoUtc: string | null): string`
  - implementacja: `new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(isoUtc))`

## 6. Zarządzanie stanem
Rekomendacja: lokalny stan w `AccountView` + dedykowany hook dla historii generowań, aby:
- utrzymać spójność z podejściem z `useFlashcardsCollection` (URL jako źródło prawdy),
- ułatwić retry, obsługę out-of-range, abortowanie requestów.

### Potencjalne zmienne stanu w `AccountView`
- `quotaState: QuotaStateVm`
- `history` (z hooka): `query`, `listState`, `isFetching`, `refetch()`, itp.
- `detailsOpen: boolean`
- `detailsId: string | null`

### Custom hook: `useGenerationsHistory(returnTo = "/account")`
Odpowiedzialności:
- utrzymywanie `query` (status/page/pageSize/sort/order) i synchronizacja z `window.location.search` (`replaceState` + obsługa `popstate`),
- pobieranie listy `GET /api/generations?...` z `AbortController`,
- `listState: GenerationsHistoryStateVm` i `isFetching`,
- `refetch()` przez token (jak w `useFlashcardsCollection`),
- korekta `page` przy out-of-range,
- centralna obsługa `401` → redirect do `/auth/login?returnTo=/account`.

### (Opcjonalnie) hook: `useGenerationQuota(returnTo = "/account")`
Odpowiedzialności:
- `GET /api/generations/quota`,
- mapowanie `DailyLimitDto` → `QuotaVm` (w tym formatowanie resetu),
- retry i obsługa błędów (w tym 401 redirect).

## 7. Integracja API

### 7.1 `GET /api/generations/quota`
- **Cel**: odczyt dziennego limitu.
- **Request**:
  - bez body, bez query
  - `credentials: "same-origin"`
- **Response 200**: `GenerationQuotaResponse` (= `DailyLimitDto`)
  - mapowanie do `QuotaVm`:
    - `resetsAtLocalLabel` na bazie `resetsAtUtc`
- **Błędy**:
  - `401` → redirect do `/auth/login?returnTo=/account` (middleware może też zrobić redirect dla strony, ale tu mówimy o fetch)
  - `500 server_error` → komunikat + retry
  - `timeout/network` → komunikat + retry

### 7.2 `GET /api/generations?status=&page=&pageSize=&sort=&order=`
- **Cel**: lista historii generowań z diagnostyką.
- **Request**:
  - query params muszą być zgodne z backendem (`src/lib/validation/generations.ts`):
    - `status` (opcjonalnie): `pending|succeeded|failed`
    - `page`: int `>=1`
    - `pageSize`: int `1..100` (default 20)
    - `sort`: `createdAt|finishedAt` (default createdAt)
    - `order`: `desc|asc` (default desc)
- **Response 200**: `GenerationListResponse`
  - mapować `items` na `GenerationRowVm[]`
  - wyliczyć `totalPages`
- **Błędy**:
  - `401` → redirect do `/auth/login?returnTo=/account`
  - `400 invalid_request` → błąd walidacji query (UI powinien oferować reset filtrów do domyślnych)
  - `500 server_error` → komunikat + retry
  - `timeout/network` → komunikat + retry

### 7.3 `GET /api/generations/{id}` (dla dialogu szczegółów)
- **Cel**: pobranie szczegółów generacji (zawsze aktualne dane).
- **Request**:
  - `id` jako UUID w ścieżce
- **Response 200**: `GenerationDetailResponse` (= `GenerationDto`)
- **Błędy**:
  - `401` → redirect
  - `404 not_found` → w dialogu pokazać „Nie znaleziono generacji” + zamknąć lub pozwolić użytkownikowi wrócić
  - `400 invalid_request` → błąd integracji (ID nie jest UUID) – w UI raczej nie wystąpi, bo ID pochodzi z listy
  - `500 server_error` → komunikat + retry

Implementacja `src/components/account/api.ts` powinna być spójna z `src/components/flashcards/api.ts`:
- `fetchWithTimeout(..., signal?)` (z `AbortController`)
- `readErrorPayload(response)` dla `ErrorResponse`
- `mapAccountApiError(payloadOrError, status?)` → `AccountApiErrorVm`
- `redirectToLogin(returnTo)` centralnie

## 8. Interakcje użytkownika
- **Wejście na `/account`**:
  - quota ładuje się automatycznie (skeleton → dane lub błąd)
  - historia generowań ładuje się automatycznie wg domyślnego query (skeleton → tabela/empty/error)
- **Wylogowanie**:
  - klik „Wyloguj” w sekcji profilu → POST `/api/auth/logout` → redirect do `/auth/login`
- **Zmiana filtra statusu**:
  - wybór statusu w `Select`:
    - aktualizuje URL (query string),
    - resetuje `page=1`,
    - pobiera listę ponownie
- **Zmiana sortowania/kolejności**:
  - aktualizuje URL + reset `page=1` + refetch
- **Zmiana pageSize**:
  - aktualizuje URL, resetuje `page=1`, refetch
- **Paginacja**:
  - „Następna/Poprzednia” zmienia `page`, refetch
- **Szczegóły generacji**:
  - klik w ikonę „Szczegóły” w wierszu → otwarcie dialogu
  - dialog pokazuje loader i pobiera `GET /api/generations/{id}`
  - w razie błędu: komunikat + „Spróbuj ponownie”

## 9. Warunki i walidacja
Warunki, które powinien weryfikować interfejs (lub zapewnić przez konstrukcję UI), zgodnie z API:

### 9.1 Walidacja query historii (`GET /api/generations`)
- **`status`**:
  - UI wystawia wyłącznie wartości: `pending|succeeded|failed` albo brak parametru (dla „Wszystkie”)
- **`page`**:
  - zawsze liczba całkowita `>= 1` (clamp w `normalizeQuery`)
- **`pageSize`**:
  - `1..100` (UI oferuje np. 20/50/100)
- **`sort`**:
  - tylko `createdAt|finishedAt`
- **`order`**:
  - tylko `desc|asc`
- **Out-of-range**:
  - gdy `total > 0` i `page > totalPages`, UI koryguje `page` do `totalPages` i refetch (jednorazowo).

### 9.2 Walidacja danych quota (`GET /api/generations/quota`)
- `resetsAtUtc`:
  - wyświetlać jako lokalny czas użytkownika (formatowanie po stronie UI),
  - w razie nieparsowalnej daty: fallback tekstowy (bez crasha).

### 9.3 Warunki a11y / UX
- Przycisk „Szczegóły” w tabeli musi mieć dostępny opis: `aria-label="Pokaż szczegóły generacji"`.
- Sekcje błędów powinny używać `role="alert"`.
- Ważne komunikaty o odświeżeniu/powodzeniu (opcjonalnie) w `aria-live="polite"`.

## 10. Obsługa błędów
Rekomendowane scenariusze i reakcje UI:
- **401 Unauthorized**:
  - natychmiastowy redirect do `/auth/login?returnTo=/account`
  - po redirect nie pokazywać dodatkowych alertów (żeby uniknąć „mignięcia” UI)
- **400 invalid_request** (lista):
  - pokazać błąd „Nieprawidłowe parametry filtrowania. Przywróć ustawienia domyślne.”
  - akcja: „Wyczyść filtry” → reset query do default
- **404 not_found** (szczegół):
  - w dialogu: „Nie znaleziono generacji. Być może została usunięta.” + zamknięcie dialogu lub retry
- **500 server_error**:
  - przyjazny komunikat + retry
- **Network / timeout**:
  - komunikat „Problem z połączeniem…” + retry

Zasada: błędy quota i historii są niezależne (błąd quota nie blokuje historii i odwrotnie).

## 11. Kroki implementacji
1. **Dodać routing strony**:
   - utworzyć `src/pages/account.astro` na wzór `dashboard.astro` i zamontować `AccountView client:load`.
2. **Włączyć ochronę trasy w middleware**:
   - w `src/middleware/index.ts` dodać `/account` do `PROTECTED_PREFIXES`.
3. **Utworzyć folder widoku**:
   - `src/components/account/` i szkielety komponentów: `AccountView`, `ProfileSection`, `QuotaCard`, `GenerationsHistorySection`, `GenerationsFilters`, `GenerationsTable`, `GenerationsPagination`, `GenerationDetailsDialog`, `api.ts`, `types.ts`.
4. **Zaimplementować typy i helpery**:
   - w `types.ts` dodać VM, mapery DTO→VM oraz helpery query (parse/serialize/normalize) w stylu `src/components/flashcards/types.ts`.
5. **Zaimplementować warstwę API** (`src/components/account/api.ts`):
   - `getGenerationQuota(returnTo)` → `QuotaVm`
   - `getGenerations(query, returnTo, signal?)` → `GenerationsListVm`
   - `getGenerationDetail(id, returnTo)` → `GenerationRowVm` (lub dedykowany VM szczegółu)
   - obsługa `401` → redirect do `/auth/login?returnTo=/account`.
6. **Zaimplementować hook historii** (`src/components/hooks/useGenerationsHistory.ts`):
   - inicjalizacja query z URL,
   - URL sync (`replaceState`) i obsługa `popstate`,
   - fetch z abort i retry token,
   - emptyKind (`no_data` vs `no_matches`),
   - korekta out-of-range strony.
7. **Zaimplementować `AccountView`**:
   - `useEffect` do pobrania quota (lub hook),
   - render sekcji z niezależnymi stanami,
   - spiąć `returnTo="/account"`.
8. **Zaimplementować UI historii**:
   - `GenerationsFilters` aktualizuje query (resetując `page=1` w odpowiednich miejscach),
   - `GenerationsTable` renderuje status badge, daty i przycisk „Szczegóły”,
   - `GenerationsPagination` działa na `page/totalPages`.
9. **Zaimplementować dialog szczegółów**:
   - trzymać `detailsOpen/detailsId` w `AccountView` lub `GenerationsHistorySection`,
   - na open fetch `GET /api/generations/{id}` + skeleton + retry.
10. **Checklist testów manualnych**:
   - Wejście na `/account` jako zalogowany: widać email, quota i listę generowań.
   - Klik „Wyloguj” w koncie: redirect do `/auth/login`.
   - Brak sesji: wejście na `/account` robi redirect do logowania z `returnTo=/account`.
   - Quota: `remaining=0` pokazuje stan „limit wykorzystany” + poprawny czas odnowienia (lokalny).
   - Historia: filtr statusu działa (pending/succeeded/failed), paginacja działa, sortowanie `createdAt/finishedAt` działa.
   - Szczegóły: klik ikony otwiera dialog; `404` i `500` mają czytelny komunikat i nie crashują widoku.

