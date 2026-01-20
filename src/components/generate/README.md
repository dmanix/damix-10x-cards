# Widok Generowania Fiszek (`/generate`)

## Przegląd
Widok `/generate` implementuje pełny przepływ MVP generowania fiszek AI:
1. Użytkownik wkleja tekst (1000–20000 znaków)
2. System generuje propozycje fiszek
3. Użytkownik weryfikuje, edytuje i akceptuje propozycje
4. System zapisuje zatwierdzone fiszki

## Architektura komponentów

```
src/pages/generate.astro
└── GenerateView.tsx (kontener główny, zarządzanie stanem)
    ├── GenerateInputPanel.tsx (pole tekstowe + walidacja)
    ├── BlockingOverlay.tsx (loader podczas generowania/zapisu)
    ├── GenerationErrorNotice.tsx (komunikaty błędów)
    └── ProposalsReviewPanel.tsx (panel weryfikacji)
        ├── ProposalsSummaryBar.tsx (statystyki + CTA)
        └── ProposalCard.tsx[] (lista propozycji)
            └── ProposalEditor.tsx (tryb edycji inline)
```

## Pliki pomocnicze
- `types.ts` - ViewModele i typy UI
- `api.ts` - Wywołania API i mapowanie błędów

## Kluczowe funkcjonalności

### Walidacja
- Długość tekstu: 1000–20000 znaków (po trim)
- Front fiszki: 1–200 znaków
- Back fiszki: 1–500 znaków
- Walidacja inline z komunikatami błędów

### Zarządzanie stanem propozycji
- **unreviewed** - nieprzejrzana
- **accepted_original** - zaakceptowana bez zmian
- **accepted_edited** - zaakceptowana po edycji
- **rejected** - odrzucona

### Akcje użytkownika
- Zaakceptuj propozycję
- Odrzuć propozycję
- Cofnij akceptację/odrzucenie (wraca do unreviewed)
- Edytuj propozycję (inline)
- Zapisz wszystkie nieodrzucone
- Zapisz tylko zatwierdzone

### Integracja API
- `POST /api/generations` - generowanie propozycji
- `POST /api/flashcards` - zapisywanie fiszek

### Obsługa błędów
- 400 - walidacja
- 403 - limit dzienny / brak uprawnień
- 422 - niska jakość tekstu
- 500 - błąd providera/serwera
- network - błędy połączenia
- 401 - automatyczny redirect do logowania

### Dostępność (WCAG 2.1 AA)
- Pełne wsparcie dla screen readers (ARIA)
- Keyboard navigation (Tab, Ctrl+Enter, Escape)
- Focus management
- Live regions dla statusów
- Semantic HTML (section, aside, article, role)

### Skróty klawiszowe
- **Ctrl+Enter** - generuj fiszki / zapisz edycję
- **Escape** - anuluj edycję
- **Tab/Shift+Tab** - nawigacja

## Przepływ UX

### 1. Stan początkowy
- Wyświetla pole tekstowe z licznikiem
- Przycisk "Generuj" disabled do czasu spełnienia walidacji

### 2. Po wklejeniu tekstu
- Licznik aktualizuje się w czasie rzeczywistym
- Komunikaty walidacji inline
- "Generuj" staje się aktywny gdy tekst 1000–20000 znaków

### 3. Podczas generowania
- Blokujący overlay z spinnerem
- Komunikat "Generowanie fiszek..."
- UI zablokowany

### 4. Po sukcesie generowania
- Wyświetla panel weryfikacji
- Lista propozycji z badge'ami statusu
- Pasek podsumowania sticky

### 5. Weryfikacja propozycji
- Użytkownik przegląda każdą propozycję
- Może zaakceptować/odrzucić/edytować
- Wizualne statusy (kolory, ikony)

### 6. Edycja propozycji
- Inline editor z walidacją
- Liczniki znaków
- Auto-focus na pierwszym polu
- Skróty klawiszowe

### 7. Zapisywanie
- Przyciski "Zapisz zatwierdzone" / "Zapisz wszystkie"
- Blokujący overlay podczas zapisu
- Komunikat sukcesu po zapisie
- Opcje: przejdź do kolekcji / generuj kolejne

### 8. Obsługa błędów
- Przyjazne komunikaty
- Możliwość retry gdzie sensowne
- Linki do akcji (np. /account przy limicie)

## Testowanie

### Checklist manualny (z planu implementacji)
- [ ] Tekst 999 znaków → przycisk disabled + komunikat
- [ ] Tekst 1000 znaków → generowanie działa
- [ ] Tekst 20001 znaków → disabled + komunikat
- [ ] 403 na generowaniu → blokada + link do /account
- [ ] 422 low quality → komunikat, brak przejścia do weryfikacji
- [ ] Edycja: front > 200 / back > 500 → błędy inline
- [ ] "Zapisz wszystkie" vs "Zapisz zatwierdzone" → poprawne payloady
- [ ] 401 na zapisie → redirect do login
- [ ] Keyboard navigation (Tab, Ctrl+Enter, Escape)
- [ ] Screen reader - aria labels, live regions
- [ ] Responsywność na mobile/tablet/desktop

## Przyszłe ulepszenia (poza MVP)
- Persistencja propozycji w localStorage
- Preview fiszek przed zapisem
- Bulk operations (zaznacz wszystkie)
- Export/import propozycji
- Zaawansowane opcje generowania (liczba fiszek, styl, etc.)
