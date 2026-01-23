# Plan implementacji widoku Dashboard (`/dashboard`)

## 1. Przegląd
Widok `Dashboard` jest pierwszym ekranem po zalogowaniu. Jego celem jest „szybki start”: użytkownik ma od razu wgląd w ostatnie aktywności (ostatnio aktualizowane fiszki i ostatnie generowania) oraz łatwą nawigację do kluczowych zadań przez topbar.

Zakres widoku (MVP):
- **Topbar** na górze strony (nawigacja do widoków aplikacji, w tym `/generate`).
- 2 kafle w siatce (grid):
  1) „Ostatnio dodane fiszki” (5 ostatnich po `updatedAt desc`),
  2) „Ostatnie generowania” (5 ostatnich po `createdAt desc`, ze statusem).
- Stany asynchroniczne dla każdej sekcji: `loading` / `empty` / `error`.
- Dostępność: pełna obsługa klawiatury, poprawna semantyka list, czytelne focus states.
- Bezpieczeństwo: trasa chroniona; odpowiedź `401` z API powoduje przekierowanie do logowania z `returnTo=/dashboard`.

Powiązanie z historyjkami:
- **US-006**: dostęp do generowania zapewniony przez link w topbarze do `/generate`.
- **US-014**: kafel z ostatnimi fiszkami + CTA „Zobacz kolekcję” (`/flashcards`).
- **US-017**: Dashboard jako punkt startu (opcjonalne CTA „Rozpocznij naukę” może zostać dodane później w topbarze / nawigacji globalnej; w tym widoku nie jest wymagane przez opis).

## 2. Routing widoku
- **Ścieżka**: `src/pages/dashboard.astro` → dostępna pod `/dashboard`.
- **Mount React**: `<DashboardView client:load />`.
- **Ochrona trasy (docelowo, zgodnie z PRD/UI planem)**:
  - w `dashboard.astro` wykonać sprawdzenie sesji użytkownika (Supabase) na etapie renderu strony i przy braku sesji wykonać redirect do `/auth/login?returnTo=/dashboard`.
  - po stronie klienta: każdy `401` z API (GET list) → `window.location.href = "/auth/login?returnTo=/dashboard"`.
  - Uwaga: w aktualnym kodzie `src/pages/generate.astro` ma komentarz TODO dotyczący ochrony trasy; Dashboard powinien mieć analogiczny mechanizm (nawet jeśli docelowo zostanie to wyniesione do wspólnego layoutu/guardu).

## 3. Struktura komponentów
Rekomendowana struktura plików:
- `src/pages/dashboard.astro` (routing + layout + mount React)
- `src/components/dashboard/DashboardView.tsx` (kontener widoku, fetch danych, stany)
- `src/components/dashboard/RecentFlashcardsCard.tsx` (mini-lista fiszek)
- `src/components/dashboard/RecentGenerationsCard.tsx` (mini-lista generowań + status badge)
- `src/components/dashboard/DashboardErrorNotice.tsx` (wspólny alert błędu dla kafli)
- `src/components/dashboard/api.ts` (wywołania GET + mapowanie błędów)
- `src/components/dashboard/types.ts` (ViewModele i helpery mapujące DTO → VM)
- `src/components/navigation/Topbar.astro` (topbar nawigacyjny; osadzany w layoucie)

Wysokopoziomowe drzewo komponentów:

```
src/pages/dashboard.astro
└── Layout.astro
    ├── Topbar.astro
    └── DashboardView.tsx
        ├── RecentFlashcardsCard.tsx
        │   └── DashboardErrorNotice.tsx (warunkowo)
        └── RecentGenerationsCard.tsx
            └── DashboardErrorNotice.tsx (warunkowo)
```

## 4. Szczegóły komponentów

### `src/pages/dashboard.astro`
- Opis komponentu: strona Astro odpowiedzialna za routing, (docelowo) ochronę sesji oraz osadzenie widoku React.
- Główne elementy:
  - `Layout.astro`
  - `<DashboardView client:load />`
- Obsługiwane zdarzenia: brak.
- Warunki walidacji: brak.
- Typy: brak.
- Propsy:
  - (opcjonalnie) `initialText?: string` albo `initialData` (jeśli kiedyś zdecydujemy się na SSR list).

### `DashboardView` (`src/components/dashboard/DashboardView.tsx`)
- Opis komponentu: kontener widoku; odpowiada za pobranie „ostatnich” danych i złożenie 2 kafli w siatkę.
- Główne elementy:
  - wrapper: `<main>` + nagłówek strony (np. `<h1>Dashboard</h1>`).
  - grid: `<section className="grid gap-4 md:grid-cols-2">` (Tailwind).
  - dzieci: `RecentFlashcardsCard`, `RecentGenerationsCard`.
- Obsługiwane zdarzenia:
  - `onRefreshFlashcards()` (retry w kaflu fiszek),
  - `onRefreshGenerations()` (retry w kaflu generowań).
- Warunki walidacji:
  - parametry query do API list muszą być zgodne z backendem:
    - flashcards: `page=1`, `pageSize=5`, `sort=updatedAt`, `order=desc`
    - generations: `page=1`, `pageSize=5`, `sort=createdAt`, `order=desc`
- Typy:
  - DTO: `FlashcardListResponse`, `GenerationListResponse`, `ErrorResponse` (z `src/types.ts`)
  - VM: `RecentFlashcardItemVm[]`, `RecentGenerationItemVm[]`, `DashboardTileState<T>`
- Propsy:
  - `returnTo?: string` (domyślnie `"/dashboard"`; używane do budowania redirectów przy `401`).

### `Topbar` (`src/components/navigation/Topbar.astro`)
- Opis komponentu: topbar nawigacyjny aplikacji w strefie chronionej; zapewnia przejścia do kluczowych widoków, w tym do generowania (`/generate`).
- Główne elementy:
  - `<header>` z kontenerem i `nav` (semantyka + dostępność).
  - Lista linków (jako `<a>` lub `Button asChild`):
    - `/dashboard` (Dashboard)
    - `/generate` (Generuj)
    - `/flashcards` (Kolekcja)
    - `/study` (Nauka)
    - `/account` (Konto)
  - Stan aktywny linku (np. `aria-current="page"` + wyróżnienie stylu).
  - (opcjonalnie w MVP) prawa strona: placeholder na menu użytkownika/wylogowanie.
- Obsługiwane zdarzenia:
  - nawigacja przez klik/Enter (domyślne zachowanie linków).
- Warunki walidacji:
  - brak.
- Typy:
  - `TopbarLinkVm` (opcjonalnie, jeśli linki są mapowane z tablicy):
    - `href: string`
    - `label: string`
    - `isActive: boolean`
- Propsy:
  - `currentPath: string` (do ustawienia aktywnego linku; w Astro dostępne jako `Astro.url.pathname`).
  - (opcjonalnie) `variant?: "public" | "protected"` jeśli topbar ma być współdzielony między layoutami.

Integracja topbara w layoucie:
- zaktualizować `src/layouts/Layout.astro`, aby:
  - przyjmował `currentPath` (lub sam korzystał z `Astro.url.pathname`),
  - renderował `Topbar` dla tras chronionych (np. `pathname !== "/"` i `!pathname.startsWith("/auth")`), albo przez jawny prop `showTopbar`.

### `RecentFlashcardsCard` (`src/components/dashboard/RecentFlashcardsCard.tsx`)
- Opis komponentu: kafel z mini-listą ostatnio aktualizowanych fiszek (5 sztuk).
- Główne elementy:
  - shadcn `Card` + nagłówek „Ostatnio dodane fiszki”
  - lista `<ul>`; każdy element jako link/wiersz z:
    - `front` (skrót, np. 1 linia),
    - `back` (skrót, np. 1 linia, opcjonalnie w mniejszym tekście),
    - `source` jako mały `Badge` (opcjonalnie; w MVP można pominąć).
  - CTA w stopce: „Zobacz wszystkie” → `/flashcards`
  - `DashboardErrorNotice` w stanie błędu
  - empty state (pierwsze użycie): tekst + CTA:
    - „Generuj fiszki” → `/generate`
    - „Dodaj manualnie” → `/flashcards` (lub docelowo `/flashcards/new` jeśli powstanie)
- Obsługiwane zdarzenia:
  - `onRetry()` (ponowienie pobrania)
  - `onNavigateToCollection()` (link)
- Warunki walidacji:
  - brak walidacji wejścia; walidacja dotyczy parametrów requestu (sztywne, zdefiniowane w `api.ts`).
- Typy:
  - DTO: `FlashcardDto`, `FlashcardListResponse`
  - VM: `RecentFlashcardsVm`:
    - `items: RecentFlashcardItemVm[]`
    - `total: number` (z response, do pokazania „Zobacz wszystkie (X)” – opcjonalnie)
- Propsy:
  - `state: DashboardTileState<RecentFlashcardsVm>`
  - `onRetry: () => void`

### `RecentGenerationsCard` (`src/components/dashboard/RecentGenerationsCard.tsx`)
- Opis komponentu: kafel z mini-listą ostatnich generowań (5 sztuk) oraz badge statusu.
- Główne elementy:
  - shadcn `Card` + nagłówek „Ostatnie generowania”
  - lista `<ul>`; każdy element jako link/wiersz z:
    - `status` badge: `pending` / `succeeded` / `failed`,
    - `createdAt` (format lokalny),
    - opcjonalnie: `generatedCount` (jeśli dostępne) lub `error` skrót dla `failed`.
  - CTA w stopce: „Zobacz historię” → `/account` (docelowo) lub inny widok historii
  - `DashboardErrorNotice` w stanie błędu
  - empty state: tekst + CTA „Generuj fiszki” → `/generate`
- Obsługiwane zdarzenia:
  - `onRetry()`
- Warunki walidacji:
  - jak wyżej: parametry requestu do listy muszą być zgodne z backendem.
- Typy:
  - DTO: `GenerationDto`, `GenerationListResponse`, `GenerationStatus`
  - VM: `RecentGenerationsVm`:
    - `items: RecentGenerationItemVm[]`
    - `total: number`
- Propsy:
  - `state: DashboardTileState<RecentGenerationsVm>`
  - `onRetry: () => void`

### `DashboardErrorNotice` (`src/components/dashboard/DashboardErrorNotice.tsx`)
- Opis komponentu: ujednolicony komunikat błędu dla kafli list (flashcards/generations) z akcją ponowienia.
- Główne elementy:
  - `div`/`Card` z `role="alert"`
  - tekst błędu (przyjazny, bez detali technicznych)
  - `Button variant="outline"` „Spróbuj ponownie”
- Obsługiwane zdarzenia:
  - `onRetry()`
- Warunki walidacji: brak.
- Typy:
  - `DashboardApiErrorVm` (minimum: `message`, `canRetry`, `kind`, `status?`)
- Propsy:
  - `error: DashboardApiErrorVm`
  - `onRetry?: () => void`

## 5. Typy

### DTO (istniejące, z `src/types.ts`)
- Flashcards:
  - `FlashcardDto`
  - `FlashcardListQuery`
  - `FlashcardListResponse` (`PaginatedResponse<FlashcardDto>`)
- Generations:
  - `GenerationDto`
  - `GenerationListQuery`
  - `GenerationListResponse` (`PaginatedResponse<GenerationDto>`)
- Wspólne:
  - `ErrorResponse`
  - `TimestampString`

### Nowe typy ViewModel (rekomendacja: `src/components/dashboard/types.ts`)

#### `type DashboardTileStatus = "idle" | "loading" | "success" | "empty" | "error"`

#### `interface DashboardApiErrorVm`
- `kind: "http" | "network" | "timeout" | "unknown" | "unauthorized"`
- `status?: number`
- `code?: string`
- `message: string`
- `canRetry: boolean`

#### `interface DashboardTileState<T>`
- `status: DashboardTileStatus`
- `data?: T`
- `error?: DashboardApiErrorVm`

#### `interface RecentFlashcardItemVm`
- `id: string`
- `front: string` (już przycięte do UI, np. 80 znaków)
- `back: string` (już przycięte, np. 120 znaków)
- `source: "manual" | "ai" | "ai-edited"`
- `updatedAt: string` (ISO)

#### `interface RecentFlashcardsVm`
- `items: RecentFlashcardItemVm[]`
- `total: number`

#### `interface RecentGenerationItemVm`
- `id: string`
- `status: "pending" | "succeeded" | "failed"`
- `createdAt: string`
- `finishedAt: string | null`
- `generatedCount: number | null`
- `errorCode: string | null`
- `errorMessage: string | null`

#### `interface RecentGenerationsVm`
- `items: RecentGenerationItemVm[]`
- `total: number`

#### Helpery mapujące
- `mapFlashcardDtoToRecentVm(dto: FlashcardDto): RecentFlashcardItemVm`
  - `front/back` skracać deterministycznie (np. `slice(0, n)` + `…`).
- `mapGenerationDtoToRecentVm(dto: GenerationDto): RecentGenerationItemVm`
  - `status` mapować 1:1.

## 6. Zarządzanie stanem
Rekomendacja: lokalny stan w `DashboardView` (`useState` + `useEffect` + `useCallback`), osobny stan dla fiszek i generowań (żeby błąd/ładowanie jednej sekcji nie blokował całego widoku).

Minimalne stany:
- `flashcardsState: DashboardTileState<RecentFlashcardsVm>`
- `generationsState: DashboardTileState<RecentGenerationsVm>`

Custom hook (opcjonalnie, dla czytelności):
- `useDashboardRecentData(returnTo: string)`:
  - pobiera oba zasoby równolegle (albo oddzielnie: `useRecentFlashcards`, `useRecentGenerations`)
  - wystawia: `flashcardsState`, `generationsState`, `refreshFlashcards()`, `refreshGenerations()`
  - enkapsuluje obsługę `401` → redirect.

## 7. Integracja API
Dashboard wykonuje tylko odczyty list:

### `GET /api/flashcards?page=1&pageSize=5&sort=updatedAt&order=desc`
- Request:
  - bez body, tylko query params:
    - `page=1` (>=1)
    - `pageSize=5` (<=100)
    - `sort=updatedAt` (dozwolone: `createdAt|updatedAt`)
    - `order=desc` (dozwolone: `desc|asc`)
- Response `200` (`FlashcardListResponse`):
  - `items` mapować na `RecentFlashcardItemVm[]`
  - `total` zachować do CTA „Zobacz wszystkie”
- Błędy:
  - `401` → redirect do `/auth/login?returnTo=/dashboard`
  - `400 invalid_request` → błąd w UI (raczej problem integracji), umożliwić retry
  - `500 server_error` → komunikat + retry

### `GET /api/generations?page=1&pageSize=5&sort=createdAt&order=desc`
- Request:
  - `page=1`, `pageSize=5`, `sort=createdAt`, `order=desc`
- Response `200` (`GenerationListResponse`):
  - `items` mapować na `RecentGenerationItemVm[]`
  - `total` zachować do CTA historii
- Błędy:
  - `401` → redirect do `/auth/login?returnTo=/dashboard`
  - `400 invalid_request` → błąd + retry
  - `500 server_error` → błąd + retry

Rekomendacja implementacyjna `src/components/dashboard/api.ts`:
- `fetchWithTimeout()` (jak w `src/components/generate/api.ts`) dla stabilności UX.
- `mapDashboardApiError(response)`:
  - mapować statusy na przyjazne komunikaty po polsku,
  - obsłużyć `401` osobno: redirect + przerwanie.
- `getRecentFlashcards()` i `getRecentGenerations()` zwracają już VM (żeby `DashboardView` pozostał „czysty”).

## 8. Interakcje użytkownika
- **Nawigacja do generowania**:
  - użytkownik klika link „Generuj” w topbarze → przejście do `/generate`.
- **Klik w element mini-listy fiszek**:
  - docelowo: przejście do `/flashcards` (z opcjonalnym wyróżnieniem fiszki po `id`),
  - MVP: link do `/flashcards`.
- **Klik w element mini-listy generowań**:
  - docelowo: przejście do historii w `/account` lub szczegółu generacji (np. `/account/generations/{id}`),
  - MVP: link do `/account`.
- **Retry w kaflu (błąd)**:
  - ponowne pobranie tylko tej sekcji (fiszek albo generowań).

## 9. Warunki i walidacja

### Warunki wynikające z API (listy)
- W Dashboardzie używamy tylko parametrów dopuszczonych przez walidatory backendu:
  - `FlashcardListQuery`: `page>=1`, `pageSize<=100`, `sort ∈ {createdAt, updatedAt}`, `order ∈ {asc, desc}`
  - `GenerationListQuery`: `page>=1`, `pageSize<=100`, `sort ∈ {createdAt, finishedAt}`, `order ∈ {asc, desc}`
- Przy pobraniu:
  - `items.length === 0` → stan `empty` (dedykowany komunikat + CTA)

## 10. Obsługa błędów
Zasady:
- Nie blokować całego widoku: błąd fiszek nie powinien uniemożliwić korzystania z kafla generowań i odwrotnie.
- Nie pokazywać surowych stacktrace’ów ani obiektów błędów; tylko przyjazne komunikaty.

Rekomendowane mapowanie:
- `401`:
  - natychmiastowy redirect do `/auth/login?returnTo=/dashboard`
- `400 invalid_request`:
  - „Nie udało się pobrać danych (nieprawidłowe parametry zapytania). Spróbuj ponownie.”
- `500 server_error`:
  - „Wystąpił błąd serwera podczas pobierania danych. Spróbuj ponownie.”
- błędy sieci/timeout:
  - „Problem z połączeniem. Sprawdź internet i spróbuj ponownie.”

## 11. Kroki implementacji
1. Zaimplementować topbar (nawigacja globalna strefy chronionej):
   - dodać `src/components/navigation/Topbar.astro` z linkami do: `/dashboard`, `/generate`, `/flashcards`, `/study`, `/account`,
   - zaktualizować `src/layouts/Layout.astro`, aby renderował topbar dla tras chronionych (lub przez prop `showTopbar`).
2. Utworzyć stronę `src/pages/dashboard.astro`:
   - użyć `Layout.astro`,
   - osadzić `DashboardView` przez `client:load`,
   - dodać (docelowo) guard sesji analogiczny do planu UI (redirect do login z `returnTo=/dashboard`).
3. Utworzyć folder `src/components/dashboard/` i szkielety komponentów (`DashboardView`, 2 kafle, `api.ts`, `types.ts`).
4. Zaimplementować `api.ts`:
   - `getRecentFlashcards()` (GET `/api/flashcards?...`)
   - `getRecentGenerations()` (GET `/api/generations?...`)
   - `fetchWithTimeout()` + mapowanie błędów + obsługa `401` (redirect).
5. Zaimplementować `types.ts`:
   - VM + helpery mapujące DTO → VM,
   - funkcje do skracania tekstu (front/back) i formatowania dat (np. `toLocaleString("pl-PL")`).
6. Zaimplementować `DashboardView`:
   - dwa niezależne stany (fiszek i generowań),
   - `useEffect` pobierające dane po mount,
   - retry per kafel.
7. Zaimplementować `RecentFlashcardsCard`:
   - stany: `loading` (skeleton), `empty` (CTA), `error` (z retry), `success` (lista).
8. Zaimplementować `RecentGenerationsCard`:
   - analogicznie + status badge (`pending/succeeded/failed`).
9. Checklist testów manualnych:
   - Topbar jest widoczny na `/dashboard` i zawiera działające linki (w tym do `/generate`),
   - aktywny link w topbarze jest poprawnie oznaczony (np. `aria-current="page"`),
   - Dashboard ładuje się i pokazuje 2 kafle w układzie responsywnym,
   - Flashcards: `loading` → `empty` (gdy brak) lub lista 5,
   - Generations: `loading` → `empty` lub lista 5 + poprawne badge statusu,
   - Retry działa niezależnie dla każdego kafla,
   - Symulacja `401` (np. mock) → redirect do `/auth/login?returnTo=/dashboard`.

