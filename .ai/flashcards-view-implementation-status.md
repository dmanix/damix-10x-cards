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

## Kolejne kroki
- Naprawić istniejące błędy UX:
  1) Textarea przy tworzeniu fiszki nadal nie łamie długich słów i to powoduje rozjechanie UI
  2) Teraz po edycji fiszki, już nie znika okienko do edycji, ale nadal nie widać komunikatu, że się udało i dodatkowo przycisk Zapisz jest nadal aktywny. W komunikacie powinien być dodatkowo przycisk "Zamknij i przeładuj listę", który przeładuje listę fiszek.
- Zweryfikowac backend DELETE /api/flashcards/{id} i zachowanie PUT z `source`.
- Dopracowac aria-live i komunikaty statusowe po mutacjach.
- Dodac ewentualne testy manualne zgodnie z planem (empty states, filtry, sort, paginacja, 401).
