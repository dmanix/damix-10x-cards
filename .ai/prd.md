# Dokument wymagań produktu (PRD) - Damix 10x Cards

## 1. Przegląd produktu
Damix 10x Cards to aplikacja internetowa zaprojektowana w celu radykalnego skrócenia czasu potrzebnego na tworzenie fiszek edukacyjnych. Aplikacja wykorzystuje sztuczną inteligencję, aby umożliwić użytkownikom automatyczne generowanie zestawów fiszek na podstawie wklejonego tekstu. Produkt jest skierowany do studentów, uczniów oraz osób samouczących się, które chcą efektywnie wykorzystywać metodę nauki opartą na regularnych powtórkach (spaced repetition), ale są zniechęcone czasochłonnym procesem manualnego przygotowywania materiałów. Główną wartością aplikacji jest oszczędność czasu i obniżenie progu wejścia do stosowania sprawdzonych technik nauki.

## 2. Problem użytkownika
Głównym problemem, który rozwiązuje aplikacja, jest wysoki koszt czasowy i wysiłkowy związany z tworzeniem wysokiej jakości fiszek. Wielu potencjalnych użytkowników systemów typu spaced repetition (np. Anki) rezygnuje z ich stosowania z powodu żmudnego, manualnego procesu wyodrębniania kluczowych informacji z materiałów źródłowych i formatowania ich w postaci pytań i odpowiedzi. Ten proces stanowi barierę, która ogranicza wykorzystanie jednej z najskuteczniejszych metod zapamiętywania.

## 3. Wymagania funkcjonalne
### FR-01: System Kont Użytkowników
- FR-01.1: Użytkownik może założyć konto, podając adres e-mail i hasło.
- FR-01.2: Użytkownik może zalogować się na swoje konto.
- FR-01.3: Dane użytkownika są bezpiecznie przechowywane w bazie danych aplikacji.
- FR-01.4: Użytkownik może się wylogować ze swojego konta.

### FR-02: Generowanie Fiszek przez AI
- FR-02.1: Interfejs zawiera pole do wklejania tekstu o długości od 1,000 do 20,000 znaków.
- FR-02.2: Generowanie jest procesem synchronicznym; interfejs informuje użytkownika o trwającym procesie.
- FR-02.3: Jakość i format fiszek (brak pytań tak/nie, limity znaków) są kontrolowane przez centralny, konfigurowalny prompt systemowy.
- FR-02.4: System potrafi zidentyfikować materiał wejściowy niskiej jakości i zwrócić użytkownikowi odpowiedni komunikat.
- FR-02.5: Każdy użytkownik ma dzienny, konfigurowalny w bazie danych, limit operacji generowania fiszek.

### FR-03: Weryfikacja i Zapisywanie Fiszek
- FR-03.1: Po wygenerowaniu, użytkownik widzi listę proponowanych fiszek w trybie tylko do odczytu.
- FR-03.2: Każda fiszka na liście ma trzy opcje: "Zaakceptuj", "Odrzuć", "Edytuj".
- FR-03.3: Opcja "Edytuj" otwiera prosty edytor tekstowy dla "przodu" (pytanie, limit 200 znaków) i "tyłu" (odpowiedź, limit 500 znaków) fiszki.
- FR-03.4: Zaakceptowane fiszki są zapisywane w osobistej kolekcji użytkownika.

### FR-04: Zarządzanie Kolekcją Fiszek
- FR-04.1: Użytkownik może manualnie stworzyć nową fiszkę od zera.
- FR-04.2: Użytkownik ma dostęp do widoku swojej kolekcji, gdzie może przeglądać wszystkie zapisane fiszki.
- FR-04.3: Użytkownik może edytować każdą fiszkę w swojej kolekcji.
- FR-04.4: Użytkownik może trwale usunąć fiszkę ze swojej kolekcji.

### FR-05: System Powtórek (Integracja)
- FR-05.1: Aplikacja integruje się z gotowym algorytmem powtórek typu open-source do zarządzania harmonogramem nauki.
- FR-05.2: Interfejs nauki pozwala na wyświetlenie "przodu" fiszki, a następnie na odkrycie "tyłu".

### FR-06: Mierzenie Sukcesu
- FR-06.1: System loguje w bazie danych interakcje użytkownika z wygenerowanymi fiszkami (zaakceptowana, zaakceptowana po edycji, odrzucona).
- FR-06.2: Każda zapisana fiszka posiada atrybut określający jej pochodzenie (wygenerowana przez AI / stworzona manualnie) a także fakt czy była później edytowana.

## 4. Granice produktu
### W zakresie MVP
- Generowanie fiszek przez AI na podstawie wprowadzonego tekstu (kopiuj-wklej).
- Manualne tworzenie fiszek.
- Przeglądanie, edycja i usuwanie fiszek.
- Prosty system kont użytkowników do przechowywania fiszek.
- Integracja fiszek z gotowym algorytmem powtórek.

### Poza zakresem MVP
- Własny, zaawansowany algorytm powtórek (jak SuperMemo, Anki).
- Import wielu formatów (PDF, DOCX, itp.).
- Współdzielenie zestawów fiszek między użytkownikami.
- Integracje z innymi platformami edukacyjnymi.
- Aplikacje mobilne (na początek tylko web).

## 5. Historyjki użytkowników
### Uwierzytelnianie i Zarządzanie Kontem
---
- ID: US-001
- Tytuł: Rejestracja nowego konta użytkownika
- Opis: Jako nowy użytkownik, chcę móc założyć konto za pomocą adresu e-mail i hasła, aby bezpiecznie przechowywać moje fiszki i mieć do nich stały dostęp.
- Kryteria akceptacji:
  1. Formularz rejestracji zawiera pola na adres e-mail, hasło i potwierdzenie hasła.
  2. System waliduje format adresu e-mail po stronie klienta i serwera.
  3. System wymaga hasła o minimalnej długości 8 znaków.
  4. Po pomyślnej rejestracji, użytkownik jest automatycznie zalogowany i przekierowany do głównego panelu aplikacji.
  5. Nowe konto użytkownika zostaje utworzone w bazie danych z zaszyfrowanym hasłem.

---
- ID: US-002
- Tytuł: Logowanie na istniejące konto
- Opis: Jako zarejestrowany użytkownik, chcę móc zalogować się na moje konto, podając e-mail i hasło, aby uzyskać dostęp do moich zapisanych fiszek.
- Kryteria akceptacji:
  1. Formularz logowania zawiera pola na adres e-mail i hasło.
  2. System weryfikuje poprawność podanych danych uwierzytelniających.
  3. Po pomyślnym zalogowaniu, użytkownik jest przekierowany do głównego panelu aplikacji.

---
- ID: US-003
- Tytuł: Obsługa próby rejestracji na istniejący e-mail
- Opis: Jako użytkownik próbujący się zarejestrować, chcę otrzymać jasny komunikat, jeśli podany przeze mnie adres e-mail jest już zajęty, abym mógł użyć innego adresu.
- Kryteria akceptacji:
  1. Gdy użytkownik próbuje zarejestrować się z adresem e-mail, który już istnieje w bazie, system wyświetla czytelny błąd.
  2. Rejestracja nie dochodzi do skutku, nowe konto nie jest tworzone.

---
- ID: US-004
- Tytuł: Obsługa nieudanej próby logowania
- Opis: Jako użytkownik próbujący się zalogować, chcę otrzymać komunikat o błędzie w przypadku podania nieprawidłowego e-maila lub hasła, abym mógł poprawić dane.
- Kryteria akceptacji:
  1. Gdy użytkownik poda błędny e-mail lub hasło, system wyświetla ogólny komunikat o nieprawidłowych danych logowania.
  2. Użytkownik pozostaje na stronie logowania i może ponowić próbę.

---
- ID: US-005
- Tytuł: Wylogowanie z systemu
- Opis: Jako zalogowany użytkownik, chcę mieć możliwość wylogowania się z systemu, aby zabezpieczyć dostęp do mojego konta na współdzielonym komputerze.
- Kryteria akceptacji:
  1. W interfejsie aplikacji znajduje się widoczny przycisk "Wyloguj".
  2. Po kliknięciu przycisku sesja użytkownika jest kończona.
  3. Użytkownik jest przekierowywany na stronę główną lub stronę logowania.

---
- ID: US-019
- Tytuł: Odzyskiwanie hasła (przypomnienie hasła)
- Opis: Jako użytkownik, który nie pamięta hasła, chcę móc zresetować hasło do konta za pomocą adresu e-mail, abym mógł odzyskać dostęp do moich fiszek.
- Kryteria akceptacji:
  1. Na ekranie logowania znajduje się link lub przycisk "Przypomnij hasło", który prowadzi do widoku odzyskiwania hasła.
  2. Widok odzyskiwania hasła zawiera pole na adres e-mail i przycisk wysyłający instrukcje resetu hasła.
  3. System waliduje format adresu e-mail po stronie klienta i serwera.
  4. Po wysłaniu żądania użytkownik widzi komunikat potwierdzający wysłanie instrukcji (bez ujawniania, czy e-mail istnieje w systemie).
  5. Użytkownik otrzymuje wiadomość e-mail z linkiem do ustawienia nowego hasła.
  6. Użytkownik może ustawić nowe hasło (min. 8 znaków), a następnie przejść do logowania.

### Generowanie Fiszek przez AI
---
- ID: US-006
- Tytuł: Generowanie fiszek z poprawnego tekstu
- Opis: Jako zalogowany użytkownik, chcę wkleić tekst (1k-20k znaków) i zainicjować proces generowania fiszek, aby szybko otrzymać zestaw propozycji do nauki.
- Kryteria akceptacji:
  1. W panelu głównym znajduje się pole tekstowe oraz przycisk "Generuj fiszki".
  2. System informuje o trwającym procesie generowania (np. loader).
  3. Po zakończeniu procesu, użytkownik jest przekierowywany do widoku weryfikacji z listą wygenerowanych fiszek.
  4. Każda fiszka ma pole "przód" (max 200 znaków) i "tył" (max 500 znaków).
  5. Operacja zmniejsza dzienny limit generowania użytkownika o 1.

---
- ID: US-007
- Tytuł: Próba generowania fiszek z tekstu o nieprawidłowej długości
- Opis: Jako użytkownik, chcę otrzymać informację zwrotną, jeśli wklejony przeze mnie tekst jest za krótki (<1k znaków) lub za długi (>20k znaków), abym mógł dostosować materiał wejściowy.
- Kryteria akceptacji:
  1. Przycisk "Generuj fiszki" jest nieaktywny, jeśli tekst nie spełnia wymogów długości.
  2. Pod polem tekstowym wyświetlany jest komunikat informujący o wymaganej długości tekstu.
  3. Proces generowania nie jest uruchamiany.

---
- ID: US-008
- Tytuł: Próba generowania fiszek z tekstu niskiej jakości
- Opis: Jako użytkownik, chcę zostać poinformowany, jeśli AI nie jest w stanie wygenerować wartościowych fiszek z dostarczonego tekstu, aby nie tracić czasu na materiał, który się nie nadaje.
- Kryteria akceptacji:
  1. Jeśli AI zwróci dedykowany komunikat o niemożności wygenerowania fiszek, jest on wyświetlany użytkownikowi.
  2. Użytkownik pozostaje w widoku wprowadzania tekstu.

---
- ID: US-009
- Tytuł: Osiągnięcie dziennego limitu generowania
- Opis: Jako użytkownik, który wykorzystał swój dzienny limit, chcę zobaczyć komunikat informujący mnie o tym, abym wiedział, kiedy będę mógł ponownie skorzystać z funkcji.
- Kryteria akceptacji:
  1. Gdy użytkownik z zerowym limitem próbuje generować fiszki, przycisk "Generuj" jest nieaktywny.
  2. System wyświetla komunikat o osiągnięciu dziennego limitu i o czasie jego odnowienia.
  3. Proces generowania nie jest uruchamiany.

### Weryfikacja i Zarządzanie Fiszkami
---
- ID: US-010
- Tytuł: Weryfikacja i akceptacja wygenerowanej fiszki
- Opis: Jako użytkownik, chcę przejrzeć listę wygenerowanych fiszek i zaakceptować te, które są poprawne, aby dodać je do mojej kolekcji.
- Kryteria akceptacji:
  1. W widoku weryfikacji każda fiszka ma przycisk "Zaakceptuj".
  2. Po kliknięciu "Zaakceptuj", fiszka jest oznaczana do zapisu w kolekcji, a jej stan w interfejsie się zmienia (np. jest wyszarzona).
  3. Akcja jest logowana w systemie jako "zaakceptowana bez zmian".

---
- ID: US-011
- Tytuł: Odrzucenie niepoprawnej fiszki
- Opis: Jako użytkownik, chcę móc odrzucić fiszki, które są błędne lub nieprzydatne, aby nie zaśmiecały mojej kolekcji.
- Kryteria akceptacji:
  1. W widoku weryfikacji każda fiszka ma przycisk "Odrzuć".
  2. Po kliknięciu "Odrzuć", fiszka jest usuwana z listy weryfikacyjnej.
  3. Akcja jest logowana w systemie jako "odrzucona".

---
- ID: US-012
- Tytuł: Edycja i akceptacja wygenerowanej fiszki
- Opis: Jako użytkownik, chcę mieć możliwość edycji "przodu" i "tyłu" fiszki przed jej zaakceptowaniem, aby poprawić drobne błędy lub dostosować treść do moich potrzeb.
- Kryteria akceptacji:
  1. W widoku weryfikacji każda fiszka ma przycisk "Edytuj".
  2. Kliknięcie "Edytuj" aktywuje pola tekstowe dla "przodu" i "tyłu" fiszki.
  3. Po dokonaniu zmian, przyciski zmieniają się na "Zapisz i zaakceptuj" oraz "Anuluj".
  4. Kliknięcie "Zapisz i zaakceptuj" dodaje poprawioną fiszkę do kolekcji.
  5. Akcja jest logowana w systemie jako "zaakceptowana po edycji".

---
- ID: US-013
- Tytuł: Manualne tworzenie nowej fiszki
- Opis: Jako użytkownik, chcę mieć możliwość ręcznego dodania nowej fiszki, gdy mam konkretne pytanie i odpowiedź do zapamiętania.
- Kryteria akceptacji:
  1. W interfejsie znajduje się opcja "Dodaj nową fiszkę".
  2. Użytkownik widzi formularz z polami na "przód" i "tył".
  3. Po wypełnieniu i zapisaniu, nowa fiszka jest dodawana do kolekcji użytkownika z oznaczeniem "stworzona manualnie".

---
- ID: US-014
- Tytuł: Przeglądanie kolekcji zapisanych fiszek
- Opis: Jako użytkownik, chcę mieć dostęp do listy wszystkich moich zapisanych fiszek, aby móc je przeglądać i zarządzać nimi.
- Kryteria akceptacji:
  1. W aplikacji istnieje dedykowana sekcja "Moja kolekcja".
  2. Wyświetla ona listę wszystkich zaakceptowanych i manualnie stworzonych fiszek.
  3. Lista umożliwia łatwe odczytanie treści "przodu" i "tyłu" każdej fiszki.

---
- ID: US-015
- Tytuł: Edycja istniejącej fiszki w kolekcji
- Opis: Jako użytkownik, chcę móc edytować fiszki, które już zapisałem w mojej kolekcji, aby zaktualizować lub poprawić ich treść.
- Kryteria akceptacji:
  1. Każda fiszka w widoku kolekcji ma opcję "Edytuj".
  2. Opcja ta otwiera formularz edycji z wypełnionymi aktualnymi danymi.
  3. Po zapisaniu zmian, treść fiszki w bazie danych jest aktualizowana.

---
- ID: US-016
- Tytuł: Usuwanie fiszki z kolekcji
- Opis: Jako użytkownik, chcę móc trwale usunąć fiszkę z mojej kolekcji, gdy uznam, że nie jest mi już potrzebna.
- Kryteria akceptacji:
  1. Każda fiszka w widoku kolekcji ma opcję "Usuń".
  2. System prosi o potwierdzenie operacji usunięcia.
  3. Po potwierdzeniu, fiszka jest trwale usuwana z bazy danych.

### Nauka
---
- ID: US-017
- Tytuł: Rozpoczęcie sesji nauki
- Opis: Jako użytkownik, chcę móc rozpocząć sesję nauki z moimi fiszkami, aby system mógł mi je prezentować zgodnie z algorytmem powtórek.
- Kryteria akceptacji:
  1. W interfejsie znajduje się przycisk "Rozpocznij naukę".
  2. Po kliknięciu, system (zintegrowany zewnętrzny algorytm) wybiera fiszkę do powtórki.
  3. Użytkownikowi wyświetlany jest "przód" (pytanie) wybranej fiszki.

---
- ID: US-018
- Tytuł: Odkrywanie odpowiedzi na fiszce
- Opis: Podczas sesji nauki, po zobaczeniu pytania, chcę móc odkryć odpowiedź, aby zweryfikować swoją wiedzę.
- Kryteria akceptacji:
  1. W widoku nauki znajduje się przycisk "Pokaż odpowiedź".
  2. Po jego kliknięciu, na ekranie pojawia się treść z "tyłu" fiszki.
  3. Po odkryciu odpowiedzi, pojawiają się opcje do oceny znajomości materiału (zgodnie z wymaganiami zintegrowanego algorytmu).

## 6. Metryki sukcesu
### MS-01: Wskaźnik Akceptacji Fiszek AI
- Opis: Procent fiszek wygenerowanych przez AI, które zostały zaakceptowane przez użytkownika (bezpośrednio lub po edycji). Miernik ten waliduje kluczową hipotezę, że AI potrafi tworzyć wartościowe materiały do nauki.
- Cel: >= 75%
- Formuła: `((Liczba fiszek zaakceptowanych bez zmian + Liczba fiszek zaakceptowanych po edycji) / Całkowita liczba wygenerowanych fiszek) * 100%`
- Sposób pomiaru: Każda akcja w panelu weryfikacji (zaakceptuj, odrzuć, edytuj i zaakceptuj) jest logowana w dedykowanej tabeli w bazie danych, powiązanej z konkretną operacją generowania.

### MS-02: Wskaźnik Wykorzystania AI
- Opis: Procent fiszek w kolekcjach użytkowników, które zostały stworzone przy użyciu generatora AI, w porównaniu do tych stworzonych manualnie. Miernik ten pokazuje, czy funkcja automatycznego generowania jest preferowaną metodą tworzenia fiszek przez użytkowników.
- Cel: >= 75%
- Formuła: `(Liczba fiszek stworzonych przez AI w kolekcjach wszystkich użytkowników) / (Całkowita liczba fiszek w kolekcjach wszystkich użytkowników) * 100%`
- Sposób pomiaru: Każda fiszka w bazie danych posiada flagę wskazującą jej pochodzenie (`AI` lub `manual`). Metryka jest obliczana na podstawie regularnych zapytań do bazy danych.
