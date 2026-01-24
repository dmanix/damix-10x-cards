# Status implementacji widoku Moja kolekcja

## Zrealizowane kroki
- Dodano routing `/flashcards` i mount widoku React w `src/pages/flashcards.astro`.
- Zainstalowano zaleznosci Radix i dodano komponenty shadcn/ui: `input`, `select`, `dialog`, `alert-dialog`, `tooltip`.
- Utworzono modele VM i helpery w `src/components/flashcards/types.ts` (parsowanie query, mapowanie DTO, pagination).
- Zaimplementowano warstwe API `src/components/flashcards/api.ts` (GET/POST/PUT/DELETE, mapowanie bledow, redirect 401).
- Zaimplementowano hook `useFlashcardsCollection` (query state, sync z URL, fetch, mutacje, loading states).
- Zaimplementowano komponenty widoku: `FlashcardsView`, `FlashcardsToolbar`, `FlashcardsList`.
- Dodano komponenty szczegolowe: `FlashcardCard`, `FlashcardInlineEditor`, `FlashcardSourceBadge`.
- Dodano dialogi: `CreateManualFlashcardDialog`, `DeleteFlashcardDialog`.
- Dodano paginacje `FlashcardsPagination` z rozmiarem strony 10/20/50/100.
- Wprowadzono poprawki UX: walidacje inline, blokady przyciskow, ograniczenie wysokosci textarea, wyrównanie toolbara.
- Dodano modal edycji fiszki i przeniesiono edycje do okna dialogowego.
- Poprawiono zachowanie zapisu edycji: zamyka modal po sukcesie, odswieza liste, komunikat w aria-live.
- Dodano lączenie dlugich slow w textarea, kartach listy i dialogu usuwania.

## Kolejne kroki
- Sprawdzic w UI dlugie teksty (karty listy, modal usuwania, textarea).
- Smoke test edycji: zapisz/anuluj -> modal znika, lista sie odswieza.


