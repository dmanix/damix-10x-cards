<conversation_summary>
<decisions>
1.  **Kontekst Wejściowy:** System nie będzie rozróżniał kontekstu ani dziedziny materiału wejściowego dostarczonego przez użytkownika. Wszystkie teksty będą traktowane w ten sam, uniwersalny sposób.
2.  **System Powtórek:** Wybór konkretnego systemu open-source do integracji algorytmu powtórek został odłożony na późniejszy etap projektu.
3.  **Proces Weryfikacji Fiszek:** Po wygenerowaniu fiszek przez AI, użytkownik zobaczy ich listę w trybie tylko do odczytu. Dla każdej fiszki dostępne będą trzy przyciski: "Zaakceptuj", "Odrzuć" oraz "Edytuj". Przycisk "Edytuj" włączy prosty, tekstowy tryb edycji dla danej fiszki.
4.  **Przetwarzanie Synchroniczne:** Proces generowania fiszek będzie synchroniczny. Jeśli użytkownik zamknie przeglądarkę w trakcie operacji, wygenerowane i niezaakceptowane fiszki zostaną utracone.
5.  **Limity Użycia:** W systemie zostanie zaimplementowany dzienny limit operacji generowania fiszek na użytkownika. Wartość limitu będzie konfigurowalna w bazie danych.
6.  **Jakość AI:** Jakość generowanych fiszek będzie sterowana za pomocą centralnego promptu zapisanego w konfiguracji aplikacji. Prompt będzie zawierał wytyczne dla AI, m.in. dotyczące unikania pytań typu tak/nie oraz limitów znaków (200 dla "przodu", 500 dla "tyłu").
7.  **Wygląd Fiszki w Trakcie Nauki:** Podczas sesji nauki na froncie fiszki widoczne będzie pole "przód" (zawierające pytanie). Pole "tył" będzie widoczne po "odwróceniu" karty i będzie zawierać odpowiedź.
8.  **Uwierzytelnianie:** System będzie korzystał z własnego mechanizmu uwierzytelniania opartego na adresie e-mail i haśle, z danymi przechowywanymi w bazie danych aplikacji.
9.  **Obsługa Tekstu Niskiej Jakości:** AI zostanie poinstruowane, aby w przypadku materiału wejściowego niskiej jakości zwrócić dedykowany komunikat o niemożności wygenerowania fiszek, który zostanie wyświetlony użytkownikowi.
10. **Metryki Sukcesu w MVP:** W ramach MVP jedynymi metrykami sukcesu będą logi dotyczące działania AI, zliczające liczbę fiszek zaakceptowanych (bez zmian i po edycji) oraz odrzuconych.
</decisions>

<matched_recommendations>
1.  **Mechanizm Oceny Fiszek:** Zaimplementowany zostanie jednoznaczny mechanizm oceny fiszek (przyciski "Zaakceptuj", "Odrzuć", "Edytuj"), co pozwoli na zbieranie precyzyjnych danych do walidacji kryteriów sukcesu.
2.  **Kontrola Kosztów AI:** Wprowadzenie konfigurowalnego dziennego limitu użycia funkcji generowania ochroni projekt przed niekontrolowanym wzrostem kosztów operacyjnych.
3.  **Zarządzanie Oczekiwaniami Użytkownika:** Interfejs będzie informował, że fiszki są generowane przez AI i warto je weryfikować. Dodatkowo, system będzie informował użytkownika, jeśli z danego tekstu nie da się wygenerować wartościowych materiałów.
4.  **Sterowanie Jakością Generowania:** Jakość i format fiszek będą zdefiniowane na poziomie centralnego promptu konfiguracyjnego, co umożliwi łatwe iterowanie i poprawę wyników AI bez zmian w kodzie.
5.  **Logowanie Wydajności AI:** System będzie zbierał precyzyjne logi dotyczące interakcji użytkownika z wygenerowanymi fiszkami (zaakceptowane bez zmian, ze zmianami, odrzucone), co jest kluczowe dla mierzenia głównego kryterium sukcesu.
</matched_recommendations>

<prd_planning_summary>
**Główne wymagania funkcjonalne produktu:**
Aplikacja umożliwi użytkownikom automatyczne generowanie fiszek edukacyjnych z wklejonego tekstu. Rdzeń funkcjonalności opiera się na systemie kont (e-mail/hasło), mechanizmie generowania fiszek przez AI oraz interfejsie do ich weryfikacji i zapisu. Użytkownik może wkleić tekst (1k-20k znaków), który zostanie synchronicznie przetworzony na zestaw proponowanych fiszek. Każda fiszka składa się z "przodu" (pytanie, do 200 znaków) i "tyłu" (odpowiedź, do 500 znaków). Użytkownik weryfikuje każdą propozycję, akceptując ją, odrzucając lub edytując przed ostatecznym zapisaniem w swojej kolekcji. W celu kontroli kosztów, wprowadzony zostanie dzienny limit generowania fiszek. Docelowo zapisane fiszki będą integrowane z zewnętrznym systemem powtórek typu open-source.

**Kluczowe historie użytkownika i ścieżki korzystania:**
1.  **Rejestracja i Logowanie:** Jako nowy użytkownik, chcę założyć konto przy użyciu e-maila i hasła, aby móc bezpiecznie przechowywać moje fiszki.
2.  **Automatyczne Generowanie Fiszek:** Jako zalogowany użytkownik, chcę wkleić tekst z moich materiałów do nauki i jednym kliknięciem wygenerować zestaw fiszek, aby zaoszczędzić czas.
3.  **Weryfikacja i Edycja:** Jako użytkownik, chcę przejrzeć wygenerowane przez AI fiszki, szybko je zaakceptować, odrzucić te nieprawidłowe lub poprawić te, które wymagają drobnych zmian, aby mieć pewność co do jakości mojego materiału do nauki.
4.  **Przechowywanie i Edycja Fiszek:** Jako użytkownik, chcę, aby wszystkie zaakceptowane przeze mnie fiszki były zapisane na moim koncie, gotowe do nauki. Będzie możliwość ich 
przeglądania i edycji.

**Ważne kryteria sukcesu i sposoby ich mierzenia:**
Głównym celem MVP jest walidacja hipotezy, że AI może skutecznie automatyzować tworzenie wysokiej jakości fiszek. Sukces będzie mierzony za pomocą następujących wskaźników, zbieranych w dedykowanej tabeli logów:
*   **Wskaźnik Akceptacji Fiszek AI:** Procent fiszek zaakceptowanych przez użytkowników (bez zmian lub po edycji) w stosunku do wszystkich wygenerowanych. Cel: 75%.
*   **Wskaźnik Wykorzystania AI:** Procent fiszek w kolekcjach użytkowników, które zostały stworzone przy użyciu generatora AI w porównaniu do tych stworzonych manualnie. Cel: 75%.

</prd_planning_summary>
</conversation_summary>