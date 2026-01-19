<conversation_summary>
<decisions>
1. MVP ma być maksymalnie proste: jedna globalna kolekcja fiszek per użytkownik (brak talii/zestawów).
2. Uwierzytelnianie i tożsamość użytkownika: używamy `auth.users` z Supabase Auth; w MVP nie tworzymy dodatkowej tabeli `profiles`.
3. Limit dzienny generowania: jest globalny (taki sam dla wszystkich) i przechowywany w tabeli konfiguracyjnej `app_config` (jako jeden z rekordów/kluczy).
4. Zużycie limitu liczymy jako zdarzenia w tabeli `generations` (każda próba generacji to wpis); w MVP dopuszczamy race condition (brak atomowej rezerwacji).
5. Tekst wejściowy nie jest przechowywany: w `generations` trzymamy tylko `input_length` oraz `input_hash`.
6. Wygenerowanych fiszek nie zapisujemy w DB: istnieją tylko na froncie do weryfikacji; dopiero zaakceptowane fiszki są zapisywane bezpośrednio do tabeli `flashcards`.
7. W tabeli `flashcards` wymagane pola dot. pochodzenia: `source` z wartościami (`ai`, `ai-edited`, `manual`) oraz `generation_id` (powiązanie z generacją dla fiszek AI).
8. Metryki sukcesu są agregowane w `generations` (bez osobnej tabeli zdarzeń): `generated_count`, `accepted_original_count`, `accepted_edited_count` i aktualizowane jako stan bieżący.
9. Struktura `generations`: pola `status` (`pending`, `succeeded`, `failed`), `created_at`, `finished_at`, `error_code`, `error_message`, `generated_count`, `accepted_original_count`, `accepted_edited_count`, `input_length`, `input_hash`.
10. Walidacje na poziomie DB ograniczamy do długości pól: `front <= 200`, `back <= 500` (bez walidacji jakości).
11. Brak wyszukiwania tekstowego w MVP; najczęstsze operacje to lista fiszek użytkownika i sprawdzenie limitu dziennego na podstawie `generations`.
12. Algorytm powtórek (spaced repetition) jest poza zakresem na MVP (brak tabel stanu powtórek).
13. Bezpieczeństwo: każda tabela ma `user_id`; RLS owner-only na każdej tabeli (użytkownik widzi/zmienia tylko własne rekordy).
14. Retencja: dane w `generations` przechowujemy bezterminowo (brak wygaszania/cleanup w MVP).
15. Zmiana limitu w trakcie dnia oraz bardziej złożone zasady limitów nie są obsługiwane w MVP.
</decisions>

<matched_recommendations>
1. Wprowadzić proste i spójne RLS „owner-only” oparte o `user_id = auth.uid()` dla wszystkich tabel aplikacyjnych (np. `flashcards`, `generations`) oraz zablokować możliwość zmiany `user_id` przez polityki/permissions.
2. Trzymać walidacje w DB tylko dla warunków deterministycznych: `CHECK (char_length(front) <= 200)` oraz `CHECK (char_length(back) <= 500)`, plus `NOT NULL` tam gdzie wymagane.
3. Zdefiniować `generations` jako tabelę zdarzeń generowania z jednoznacznym statusem i polami diagnostycznymi (`status`, `created_at`, `finished_at`, `error_code`, `error_message`) oraz danymi wejściowymi (`input_length`, `input_hash`) dla limitów i audytu.
4. Skupić indeksowanie na oczywistych ścieżkach MVP: szybkie pobieranie listy fiszek użytkownika oraz szybkie liczenie/sprawdzanie generacji użytkownika w danym oknie dobowym (indeksy po `user_id` + czas).
5. Trzymać metryki sukcesu jako liczniki w `generations` (zgodnie z decyzją) i powiązać fiszki AI z `generation_id`, aby dało się wyliczać/porównywać metryki także przez join (spójność i weryfikacja).
6. Utrzymywać minimalny model danych (brak `decks`, brak `generated_flashcards`, brak tabel powtórek) i zostawić miejsce na przyszłą rozbudowę bez łamania RLS (np. przez konsekwentne `user_id` + FK).
7. Do sprawdzania limitów bazujemy na czasie UTC
8. Nieudane generacje (`failed`) nie liczą się do limitu dziennego
9. `flashcards` wspiera tylko twarde usuwanie
10. `app_config`: nie jest dostępny publicznie (tylko dla backendu)
</matched_recommendations>

<database_planning_summary>
### a) Główne wymagania dotyczące schematu bazy danych
- Autoryzacja przez Supabase Auth (`auth.users`), bez dodatkowych profili użytkownika w MVP.
- Zapisywane są tylko zaakceptowane fiszki; propozycje AI nie są persystowane.
- Rejestrowanie prób generowania w `generations` wraz z:
  - danymi wejściowymi bez treści (`input_length`, `input_hash`)
  - statusem i diagnostyką (`status`, `created_at`, `finished_at`, `error_code`, `error_message`)
  - licznikami metryk (`generated_count`, `accepted_original_count`, `accepted_edited_count`)
- Konfiguracja globalna w `app_config`, w tym globalny dzienny limit generacji.
- Twarde walidacje DB tylko na długości `flashcards.front` i `flashcards.back`.
- Brak funkcji wyszukiwania tekstowego i brak modelu powtórek na MVP.
- Dane w `generations` przechowywane bezterminowo.

### b) Kluczowe encje i ich relacje
- **`auth.users` (Supabase)**: źródło `user_id` (UUID) dla wszystkich danych aplikacji.
- **`flashcards`**:
  - należy do użytkownika (`user_id`).
  - zawiera treść `front`, `back`.
  - ma `source` ∈ (`ai`, `edited-ai`, `manual`).
  - ma `generation_id` (powiązanie z `generations`) dla fiszek pochodzących z AI (dla manual może być `NULL`).
- **`generations`**:
  - należy do użytkownika (`user_id`).
  - reprezentuje zdarzenie/próbę generacji.
  - przechowuje liczniki metryk oraz status wykonania.
- **`app_config`**:
  - przechowuje globalne ustawienia aplikacji (w tym limit dzienny); odczyt potrzebny do weryfikacji limitu.

Relacje (na poziomie koncepcyjnym):
- `auth.users (1) -> (N) flashcards`
- `auth.users (1) -> (N) generations`
- `generations (1) -> (N) flashcards` (tylko dla `source` związanych z AI; w praktyce `flashcards.generation_id` jest opcjonalne)

### c) Ważne kwestie dotyczące bezpieczeństwa i skalowalności
- **RLS**:
  - Na tabelach per-user (`flashcards`, `generations`) polityki owner-only oparte o `user_id = auth.uid()` dla `SELECT/INSERT/UPDATE/DELETE`.
  - Wymusić, aby `INSERT.user_id` był równy `auth.uid()` (np. przez `WITH CHECK` w policy).
  - Ograniczyć aktualizacje tak, aby użytkownik nie mógł zmienić `user_id`.
- **Dane wrażliwe**:
  - Brak przechowywania tekstu wejściowego; tylko hash i długość, co ogranicza ryzyko ujawnienia materiałów.
- **Wydajność** (MVP):
  - Indeksy pod najczęstsze zapytania:
    - lista fiszek użytkownika (np. indeks po `flashcards.user_id` + sort po czasie)
    - sprawdzanie limitu generacji po czasie (indeks po `generations.user_id` + `created_at`)
  - Brak FTS upraszcza schemat i koszty.
- **Race condition limitu**:
  - Świadomie zaakceptowane w MVP; ryzyko sporadycznego przekroczenia limitu przy równoległych żądaniach.

</database_planning_summary>
</conversation_summary>