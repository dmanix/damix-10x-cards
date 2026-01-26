# Specyfikacja Architektury Autentykacji - Damix 10x Cards

## 1. Wstęp
Niniejszy dokument opisuje architekturę modułu autentykacji (Rejestracja, Logowanie, Wylogowanie, Odzyskiwanie hasła) dla aplikacji Damix 10x Cards, opartej na stacku Astro 5 (SSR), React 19 oraz Supabase. Implementacja realizuje wymagania US-001 do US-005 oraz US-019.

## 2. Zmiany w Stacku Technologicznym
Aby obsłużyć Server-Side Rendering (SSR) w Astro z autentykacją, konieczne jest dodanie biblioteki pomocniczej do zarządzania ciasteczkami.

- **Nowa zależność:** `@supabase/ssr`
- **Cel:** Obsługa sesji poprzez ciasteczka HTTP-only, co pozwala serwerowi Astro weryfikować tożsamość użytkownika przed wyrenderowaniem strony.

## 2.1. Zgodność z istniejącym działaniem aplikacji
W codebase istnieją już przekierowania do logowania po stronie klienta w postaci `/auth/login?returnTo=...` (np. moduły `src/components/*/api.ts`) oraz logika ukrywania topbara dla ścieżek zaczynających się od `/auth` (w `src/layouts/Layout.astro`). Specyfikacja przyjmuje więc **docelowe ścieżki `/auth/*`**, aby nie naruszyć obecnego działania aplikacji i uniknąć rozjazdu nawigacji.

## 3. Architektura Interfejsu Użytkownika (Frontend)

### 3.1. Nowe Strony i Trasy
| Ścieżka | Plik Astro | Dostęp | Opis |
|---------|------------|--------|------|
| `/auth/login` | `src/pages/auth/login.astro` | Publiczny (Guest only) | Formularz logowania. Po sukcesie przekierowanie do `returnTo` lub `/dashboard`. |
| `/auth/register` | `src/pages/auth/register.astro` | Publiczny (Guest only) | Formularz rejestracji. Po sukcesie auto-logowanie i przekierowanie do `returnTo` lub `/dashboard` (US-001). |
| `/auth/reset-password` | `src/pages/auth/reset-password.astro` | Publiczny (Guest only) | Formularz odzyskiwania hasła oraz ustawienia nowego hasła po kliknięciu linku z e-maila (US-019). |
| `/api/auth/*` | `src/pages/api/auth/*.ts` | Publiczny | Endpointy API obsługujące żądania auth (POST). |

### 3.2. Layouty
Wprowadzenie podziału layoutów w celu obsługi różnych kontekstów nawigacyjnych.

1.  **`AuthLayout.astro` (Nowy)**
    *   Używany na stronach `/auth/login` i `/auth/register`.
    *   **Struktura:** Wyśrodkowany kontener na pełnym ekranie. Brak paska nawigacyjnego (Topbar) i bocznego menu.
    *   **Styl:** Czysty, skupiający uwagę na formularzu.

2.  **Modyfikacja `Layout.astro` (Główny)**
    *   Layout ten pozostaje dla stron aplikacji (`/dashboard`, etc.).
    *   Wymaga integracji z danymi sesji przekazywanymi z Middleware, aby przekazać stan zalogowania do komponentu `Topbar`.

### 3.3. Komponenty React (`src/components/auth/`)
Interaktywne elementy formularzy będą zaimplementowane w React, wykorzystując `shadcn/ui` oraz `react-hook-form` z `zod` do walidacji.

1.  **`LoginForm.tsx`**
    *   Pola: Email, Hasło.
    *   Walidacja: Email (format), Hasło (wymagane).
    *   Akcja: `POST` do `/api/auth/login`.
    *   Obsługa błędów: Wyświetlanie komunikatu "Nieprawidłowy email lub hasło" (US-004).
    *   **Link "Przypomnij hasło"**: prowadzi do `/auth/reset-password` (US-019).

2.  **`RegisterForm.tsx`**
    *   Pola: Email, Hasło, Powtórz hasło.
    *   Walidacja: Email (format), Hasło (min. 8 znaków - US-001), Zgodność haseł.
    *   Akcja: `POST` do `/api/auth/register`.
    *   Obsługa błędów: "Użytkownik o takim adresie email już istnieje" (US-003).

3.  **`ResetPasswordRequestForm.tsx`**
    *   Pola: Email.
    *   Walidacja: Email (format) po stronie klienta.
    *   Akcja: `POST` do `/api/auth/reset-password` (wysłanie e-maila z linkiem).
    *   UX: zawsze pokazuje neutralny komunikat typu "Jeśli konto istnieje, wyślemy instrukcję…" (US-019).

4.  **`UpdatePasswordForm.tsx`**
    *   Pola: Nowe hasło, Powtórz nowe hasło.
    *   Walidacja: min. 8 znaków, zgodność haseł.
    *   Akcja: `POST` do `/api/auth/update-password` (ustawienie nowego hasła).
    *   Po sukcesie: przekierowanie do `/auth/login`.

5.  **`LogoutButton.tsx`**
    *   Przycisk umieszczany w Topbarze lub profilu użytkownika.
    *   Akcja: `POST` do `/api/auth/logout`.

## 4. Logika Backendowa (Server-Side)

### 4.1. Klient Supabase
Należy zrefaktoryzować sposób inicjalizacji klienta Supabase tak, aby w SSR operował na cookies i mógł je **czytać oraz aktualizować** (refresh token) w ramach żądania.

*   **Server Instance (`createSupabaseServerInstance` w `src/db/supabase.client.ts`):**
    *   Używany w API Routes oraz Middleware.
    *   Implementowany przez `createServerClient` z `@supabase/ssr`.
    *   Zarządzanie cookies wyłącznie przez `getAll` i `setAll` (bez `get/set/remove` pojedynczych cookies).
    *   Cookie options: `httpOnly`, `secure`, `sameSite=lax`, `path=/`.
*   **Browser Client (opcjonalnie później):**
    *   Do US-001..US-005 nie jest konieczny, bo auth realizujemy przez API + cookies.

### 4.2. Middleware (`src/middleware/index.ts`)
Middleware jest kluczowym elementem bezpieczeństwa.

**Zadania:**
1.  Tworzy instancję klienta Supabase dla bieżącego żądania.
2.  Wywołuje `supabase.auth.getUser()`, aby zweryfikować token w ciasteczku.
    *   *Uwaga:* Nie używać `getSession()` w middleware, ponieważ jest to niebezpieczne. Należy używać `getUser()`.
3.  Zapisuje obiekt użytkownika (jeśli istnieje) w `context.locals.user`.
4.  **Logika przekierowań:**
    *   Jeśli brak użytkownika i trasa jest chroniona (`/dashboard`, `/generate`, `/flashcards`) -> Przekierowanie `302` do `/auth/login?returnTo=<ścieżka>`.
    *   Jeśli użytkownik jest zalogowany i wchodzi na `/auth/login` lub `/auth/register` -> Przekierowanie `302` do `/dashboard` (lub do `returnTo`, jeśli ustawione).
    *   Ścieżki publiczne powinny obejmować `/auth/reset-password` oraz endpointy resetu hasła.

### 4.3. Endpointy API (`src/pages/api/auth/`)
Ze względu na architekturę SSR Astro, proces logowania najlepiej obsłużyć poprzez formularze przesyłające dane do endpointów serwerowych.

1.  **`login.ts` (POST):**
    *   Odbiera dane logowania (JSON lub `FormData`) `email`, `password`.
    *   Waliduje dane wejściowe po stronie serwera (Zod): format email, wymagane pola.
    *   Używa serwerowego klienta Supabase do `signInWithPassword`.
    *   W przypadku sukcesu: Supabase automatycznie ustawi nagłówki `Set-Cookie`.
    *   Zwraca przekierowanie do `returnTo` lub `/dashboard` (US-002).
    *   W przypadku błędnych danych zwraca ogólny komunikat (US-004) bez ujawniania szczegółów.
    
2.  **`register.ts` (POST):**
    *   Odbiera dane rejestracji (JSON lub `FormData`) `email`, `password`, `passwordConfirm`.
    *   Waliduje dane wejściowe po stronie serwera (Zod): format email, min. 8 znaków hasła, zgodność haseł (US-001).
    *   Wywołuje `supabase.auth.signUp`.
    *   **Wymóg US-001 (auto-logowanie):** Konfiguracja Supabase dla MVP powinna mieć wyłączony obowiązek potwierdzenia email przed sesją, aby po rejestracji użytkownik otrzymał sesję i cookies.
    *   W przypadku próby rejestracji na istniejący email zwraca czytelny błąd (US-003) i nie tworzy konta.
    *   Zwraca przekierowanie do `returnTo` lub `/dashboard`.

3.  **`logout.ts` (POST/GET):**
    *   Używa serwerowego klienta Supabase do `signOut`.
    *   Czyści ciasteczka.
    *   Przekierowuje do `/` (strona główna) lub `/auth/login` (US-005).

4.  **`reset-password.ts` (POST):**
    *   Odbiera `email` (JSON lub `FormData`).
    *   Waliduje format email (Zod).
    *   Wywołuje `supabase.auth.resetPasswordForEmail(email, { redirectTo })`, gdzie `redirectTo` wskazuje na `/auth/reset-password`.
    *   **Bezpieczeństwo:** endpoint zwraca odpowiedź 200 i neutralny komunikat niezależnie od tego, czy e-mail istnieje (US-019).

5.  **`update-password.ts` (POST):**
    *   Odbiera `password`, `passwordConfirm` (JSON lub `FormData`).
    *   Waliduje min. 8 znaków i zgodność haseł (Zod).
    *   Wymaga aktywnej sesji odzyskanej z linku (cookies). Ustawia hasło przez `supabase.auth.updateUser({ password })`.
    *   Po sukcesie może przekierować do `/auth/login`.

### 4.4. Obsługa linku z e-maila (recovery)
Link z e-maila resetu hasła powinien kierować na `/auth/reset-password`. Widok powinien obsłużyć dwa stany:
1.  **Stan żądania resetu:** pokazuje `ResetPasswordRequestForm`.
2.  **Stan ustawienia nowego hasła:** gdy w URL jest kod/token recovery, serwer (SSR) wymienia go na sesję (np. `exchangeCodeForSession` w ramach `createSupabaseServerInstance`), zapisuje cookies i renderuje `UpdatePasswordForm`.

## 5. Modyfikacja Istniejących Elementów

### 5.1. `src/env.d.ts`
Rozszerzenie interfejsu `App.Locals`, aby zawierał typ użytkownika.
```typescript
declare namespace App {
  interface Locals {
    user: User | null; // User z @supabase/supabase-js
    supabase: SupabaseClient;
  }
}
```

### 5.2. `src/db/database.types.ts`
Bez zmian, ale należy upewnić się, że typy są dostępne dla nowego klienta.

### 5.3. Usunięcie Mockowania
Należy usunąć lub oznaczyć jako "deprecated" stałą `DEFAULT_USER_ID` w `src/db/supabase.client.ts` i zastąpić jej użycie pobieraniem ID z `context.locals.user.id` w endpointach API, które obsługują logikę biznesową (generowanie, fiszki).

## 6. Plan Wdrożenia

1.  Instalacja `@supabase/ssr`.
2.  Konfiguracja `createSupabaseServerInstance` w `src/db/supabase.client.ts` (cookies: `getAll`/`setAll`).
3.  Aktualizacja Middleware (ochrona tras + `returnTo`, wstrzyknięcie `locals.user`).
4.  Implementacja API Routes (`login`, `register`, `logout`, `reset-password`, `update-password`) w `src/pages/api/auth/`.
5.  Stworzenie komponentów UI formularzy (React).
6.  Stworzenie stron `/auth/login`, `/auth/register`, `/auth/reset-password` oraz layoutu `AuthLayout`.
7.  Integracja `Topbar` z stanem logowania.
8.  Refaktoryzacja istniejących serwisów (FlashcardService, GenerationService), aby przyjmowały `userId` dynamicznie z kontekstu sesji, zamiast używać hardcodowanego ID.

## 7. Bezpieczeństwo
- Walidacja danych wejściowych po stronie serwera (Zod).
- Ochrona przed CSRF (Astro domyślnie posiada mechanizmy, formularze React będą wysyłać żądania do tej samej domeny).
- Hasła nie są przechowywane w aplikacji, tylko przesyłane bezpośrednio do Supabase.
- Dla odzyskiwania hasła: komunikaty nie mogą ujawniać, czy konto o danym e-mail istnieje (US-019).
