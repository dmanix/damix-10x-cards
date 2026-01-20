<conversation_summary>
<decisions>
1. Główne widoki MVP: ekran autoryzacji (rejestracja/logowanie), `Dashboard`, widok generowania fiszek (POST `/generations` + POST `/flashcards`), widok listy fiszek (edycja/usuwanie), panel użytkownika, widok nauki (sesje powtórkowe).
2. Nawigacja: topbar oparty o `Navigation Menu` z shadcn/ui; na mobile przechodzi w menu hamburger.
3. Ochrona dostępu: wszystkie widoki poza rejestracją/logowaniem wymagają aktywnej sesji (JWT Supabase); wylogowanie dostępne także globalnie w topbarze.
4. Generowanie: licznik znaków, walidacja w czasie rzeczywistym, przycisk „Generuj” disabled poza 1,000–20,000 znaków; blokujący loader, timeout + opcja ponowienia.
5. Limit dzienny: quota i czas resetu pokazywane tylko w panelu użytkownika (GET `/generations/quota`).
6. `Dashboard` po zalogowaniu: 3 kafle — „Generuj fiszki”, „Ostatnio dodane fiszki” (GET `/flashcards` sort=updatedAt desc, pageSize=5), „Ostatnie generowania” (GET `/generations` sort=createdAt desc, pageSize=5).
7. Weryfikacja propozycji: stan lokalny (zaakceptuj/odrzuć/edytuj) + zbiorczy zapis do bazy przez POST `/flashcards`.
8. Weryfikacja — akcje zapisu: „Zapisz wszystkie” = zaakceptuj wszystkie nieodrzucone (niezmienione `ai`, zmienione `ai-edited`); „Zapisz zatwierdzone” = zapisz tylko ręcznie zaakceptowane.
9. Persistencja propozycji: w MVP brak — po odświeżeniu strony propozycje przepadają.
10. Błędy przy zapisie zbiorczym: brak obsługi częściowej — jeśli API zwróci błąd, użytkownik ponawia zapis całym nowym requestem.
11. Widok listy fiszek: wyszukiwanie, filtrowanie po źródle, paginacja (GET `/flashcards` z `search`, `source`, `page`, `pageSize`, `sort`, `order`).
12. Edycja/usuwanie fiszek: edycja w `Dialog/Sheet` (shadcn/ui), usuwanie w `AlertDialog`; źródło fiszki oznaczane dyskretną ikonką („AI”, „AI (edytowana)”, „Manualna”).
13. Historia generowań: jako sekcja w panelu użytkownika z filtrem statusu i linkiem do szczegółu (GET `/generations`, GET `/generations/{id}`).
14. Panel użytkownika: e-mail, wylogowanie, quota, historia generowań.
15. Widok nauki: pokazuje przód fiszki, przycisk odsłonięcia tyłu oraz mechanizm oceny; integracją danych dla nauki „na razie się nie zajmujemy”.
</decisions>

<matched_recommendations>
1. Mapowanie IA do zasobów API: `generations` (generowanie + historia) i `flashcards` (kolekcja + CRUD) jako rdzeń architektury UI.
2. Guardy tras + spójna obsługa `401`: przekierowanie do logowania i bezpieczne wygaszanie sesji (JWT Supabase).
3. Walidacja i UX generowania zgodnie z kontraktem API: licznik, disabled przycisku, komunikaty dla błędów długości i retry po timeout.
4. Stan weryfikacji jako lokalny „session-like” z jedną operacją POST `/flashcards` (zbiorczo), z regułami `source`/`generationId`.
5. Strategia listy fiszek: filtrowanie, wyszukiwanie, paginacja sterowane parametrami GET `/flashcards`; cache/odświeżanie po mutacjach.
6. Wzorce shadcn/ui: topbar `Navigation Menu`, edycja w `Dialog/Sheet`, usuwanie w `AlertDialog`, dyskretne oznaczanie źródła ikoną.
7. Umieszczenie historii generowań w panelu użytkownika (diagnostyka, statusy, szczegóły generowania).
8. Mobile-first nawigacja: hamburger na małych ekranach, poprawne stany aktywne i wsparcie klawiatury/ARIA.
</matched_recommendations>

<ui_architecture_planning_summary>
- Główne wymagania architektury UI:
  - Aplikacja web (Astro 5 + React 19 + TS 5 + Tailwind 4 + shadcn/ui) z widokami chronionymi sesją (Supabase Auth JWT).
  - Kluczowe funkcje MVP: generowanie fiszek z tekstu (1k–20k), weryfikacja propozycji (zaakceptuj/odrzuć/edytuj), zapis do kolekcji, przegląd/edycja/usuwanie fiszek, panel użytkownika z limitem i historią generowań, widok nauki (front → reveal back → ocena).

- Kluczowe widoki, ekrany i przepływy użytkownika:
  - Autoryzacja: rejestracja/logowanie → przekierowanie do `Dashboard`.
  - `Dashboard`: 3 kafle (CTA do generowania + lista ostatnich generowań + lista ostatnio dodanych fiszek) jako start po zalogowaniu.
  - Generowanie: pole tekstowe z licznikiem, walidacją i disabled; po „Generuj” blokujący loader; po sukcesie przejście do weryfikacji propozycji.
  - Weryfikacja: lista propozycji read-only z akcjami per fiszka (zaakceptuj/odrzuć/edytuj); dwa CTA końcowe: „Zapisz wszystkie” i „Zapisz zatwierdzone”; zapis zbiorczy POST `/flashcards`.
  - Kolekcja fiszek: lista z filtrami (`source`), wyszukiwaniem i paginacją; edycja przez `Dialog/Sheet`, usuwanie przez `AlertDialog`, źródło oznaczone ikoną.
  - Panel użytkownika: e-mail, wylogowanie, quota (GET `/generations/quota`), historia generowań (lista + szczegół).
  - Nauka: ekran sekwencyjny (front → pokaż odpowiedź → ocena), bez doprecyzowanej integracji danych na tym etapie.

- Strategia integracji z API i zarządzania stanem:
  - `Dashboard`: pobiera krótkie listy przez GET `/flashcards` (sort=updatedAt desc, pageSize=5) i GET `/generations` (pageSize=5).
  - Generowanie: POST `/generations` (synchroniczne) → w pamięci przechowywane proposals + `generation.id` i `dailyLimit`.
  - Weryfikacja: lokalny stan decyzji i edycji; zapis przez jeden POST `/flashcards` z poprawnymi `source` i `generationId`.
  - Kolekcja: GET `/flashcards` sterowany parametrami; mutacje PUT/DELETE odświeżają listę; usuwanie optymistyczne z rollback przy błędzie.
  - Obsługa błędów zapisu zbiorczego: brak partial — przy błędzie API użytkownik ponawia pełny zapis kolejnym requestem.
  - Persistencja propozycji: brak; refresh strony w weryfikacji = utrata propozycji.

- Responsywność, dostępność i bezpieczeństwo:
  - Responsywność: topbar z `Navigation Menu`, na mobile hamburger; widoki projektowane mobile-first.
  - Dostępność: komponenty shadcn/ui jako baza (fokus/ARIA), wymagane wsparcie klawiatury szczególnie w nawigacji i dialogach.
  - Bezpieczeństwo: ochrona tras dla widoków poza auth; obsługa wygasłej sesji (`401`) w UI; wylogowanie widoczne także w topbarze.

- Wpływ struktury API na UI:
  - Rozdział na `generations` i `flashcards` determinuje przepływ: generowanie → proposals → zbiorczy zapis do `flashcards` z `generationId` i `source`.
  - Historia generowań (GET `/generations`, GET `/generations/{id}`) naturalnie ląduje w panelu użytkownika jako diagnostyka i podgląd przebiegu.
</ui_architecture_planning_summary>

<unresolved_issues>
1. Nauka: brak doprecyzowania źródła „następnej fiszki” i zapisu oceny (API nie opisuje endpointów dla harmonogramu/sesji) — decyzja odroczona.
2. UX utraty propozycji po refresh w weryfikacji: świadoma decyzja MVP, ale wymaga jasnego komunikatu/ostrzeżenia w UI.
3. Strategia błędów dla POST `/flashcards` (bez partial): brak doprecyzowania, jak UI ma prezentować błąd i umożliwiać ponowienie bez utraty lokalnych decyzji.
</unresolved_issues>
</conversation_summary>