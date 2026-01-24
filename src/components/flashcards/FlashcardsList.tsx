import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { FlashcardsListStateVm } from "./types";
import { FlashcardCard } from "./FlashcardCard";

interface FlashcardsListProps {
  state: FlashcardsListStateVm;
  editingId: string | null;
  onRetry: () => void;
  onStartEdit: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onResetFilters: () => void;
  onOpenCreate?: () => void;
}

export function FlashcardsList({
  state,
  editingId,
  onRetry,
  onStartEdit,
  onRequestDelete,
  onResetFilters,
  onOpenCreate,
}: FlashcardsListProps) {
  if (state.status === "loading") {
    return (
      <section aria-label="Lista fiszek" className="mt-6 space-y-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </CardContent>
            <CardFooter className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </CardFooter>
          </Card>
        ))}
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section aria-label="Lista fiszek" className="mt-6 rounded-sm border border-border p-6" role="alert">
        <h2 className="text-lg font-semibold">Nie udało się pobrać fiszek</h2>
        <p className="mt-2 text-sm text-muted-foreground">{state.error?.message}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {state.error?.canRetry ? (
            <Button type="button" onClick={onRetry}>
              Spróbuj ponownie
            </Button>
          ) : null}
          {state.error?.action?.type === "link" ? (
            <Button asChild variant="outline">
              <a href={state.error.action.href}>{state.error.action.label}</a>
            </Button>
          ) : null}
        </div>
      </section>
    );
  }

  if (state.status === "empty") {
    return (
      <section
        aria-label="Lista fiszek"
        className="mt-6 rounded-sm border border-dashed border-border p-10 text-center"
      >
        {state.emptyKind === "no_matches" ? (
          <>
            <h2 className="text-lg font-semibold">Brak dopasowań</h2>
            <p className="mt-2 text-sm text-muted-foreground">Zmień kryteria wyszukiwania lub wyczyść filtry.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button type="button" variant="outline" onClick={onResetFilters}>
                Wyczyść filtry
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold">Brak fiszek w kolekcji</h2>
            <p className="mt-2 text-sm text-muted-foreground">Wygeneruj nowe fiszki lub dodaj je ręcznie.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline">
                <a href="/generate">Generuj AI</a>
              </Button>
              {onOpenCreate ? (
                <Button type="button" onClick={onOpenCreate}>
                  Dodaj manualnie
                </Button>
              ) : null}
            </div>
          </>
        )}
      </section>
    );
  }

  if (!state.data) {
    return null;
  }

  return (
    <section aria-label="Lista fiszek" className="mt-6 space-y-4">
      <ul className="space-y-4">
        {state.data.items.map((item) => (
          <li key={item.id}>
            <FlashcardCard
              item={item}
              isEditing={editingId === item.id}
              onStartEdit={onStartEdit}
              onRequestDelete={onRequestDelete}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
