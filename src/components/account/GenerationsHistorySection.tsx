import React, { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GenerationsFilters } from "./GenerationsFilters";
import { GenerationsTable } from "./GenerationsTable";
import { GenerationsPagination } from "./GenerationsPagination";
import { GenerationDetailsDialog } from "./GenerationDetailsDialog";
import { useGenerationsHistory } from "@/components/hooks/useGenerationsHistory";
import type { GenerationsQueryVm } from "./types";
import { parseGenerationsQueryFromUrl } from "./types";

interface GenerationsHistorySectionProps {
  returnTo?: string;
}

export const GenerationsHistorySection = ({ returnTo = "/account" }: GenerationsHistorySectionProps) => {
  const { query, setQuery, listState, isFetching, refetch } = useGenerationsHistory(returnTo);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const handleQueryChange = useCallback(
    (nextQuery: GenerationsQueryVm) => {
      setQuery(nextQuery);
    },
    [setQuery]
  );

  const handleResetFilters = useCallback(() => {
    setQuery(parseGenerationsQueryFromUrl(""));
  }, [setQuery]);

  const handleOpenDetails = useCallback((id: string) => {
    setDetailsId(id);
    setDetailsOpen(true);
  }, []);

  const handleCloseDetails = useCallback(
    (open: boolean) => {
      if (!open) {
        setDetailsOpen(false);
        setDetailsId(null);
      }
    },
    [setDetailsOpen, setDetailsId]
  );

  const items = useMemo(() => listState.data?.items ?? [], [listState.data?.items]);

  return (
    <section className="mt-8" aria-label="Historia generowań" aria-busy={isFetching}>
      <div className="flex flex-col gap-4">
        <GenerationsFilters
          query={query}
          onQueryChange={handleQueryChange}
          onReset={handleResetFilters}
          disabled={isFetching}
        />

        {listState.status === "loading" ? (
          <Card className="p-6">
            <div className="space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </Card>
        ) : null}

        {listState.status === "error" ? (
          <section className="rounded-sm border border-border p-6" role="alert">
            <h2 className="text-lg font-semibold">Nie udało się pobrać historii</h2>
            <p className="mt-2 text-sm text-muted-foreground">{listState.error?.message}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {listState.error?.canRetry ? (
                <Button type="button" onClick={refetch}>
                  Spróbuj ponownie
                </Button>
              ) : null}
              {listState.error?.action?.type === "link" ? (
                <Button asChild variant="outline">
                  <a href={listState.error.action.href}>{listState.error.action.label}</a>
                </Button>
              ) : null}
              {listState.error?.kind === "validation" ? (
                <Button type="button" variant="outline" onClick={handleResetFilters}>
                  Wyczyść filtry
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}

        {listState.status === "empty" ? (
          <section className="rounded-sm border border-dashed border-border p-10 text-center">
            {listState.emptyKind === "no_matches" ? (
              <>
                <h2 className="text-lg font-semibold">Brak dopasowań</h2>
                <p className="mt-2 text-sm text-muted-foreground">Zmień filtry lub przywróć ustawienia domyślne.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button type="button" variant="outline" onClick={handleResetFilters}>
                    Wyczyść filtry
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold">Brak generowań</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Nie masz jeszcze żadnych generacji. Uruchom nowe generowanie, aby zobaczyć historię.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button asChild variant="outline">
                    <a href="/generate">Generuj AI</a>
                  </Button>
                </div>
              </>
            )}
          </section>
        ) : null}

        {listState.status === "success" && listState.data ? (
          <>
            <GenerationsTable items={items} onOpenDetails={handleOpenDetails} />
            <GenerationsPagination
              page={listState.data.page}
              totalPages={listState.data.totalPages}
              total={listState.data.total}
              onPageChange={(page) => setQuery({ ...query, page })}
              disabled={isFetching}
            />
          </>
        ) : null}
      </div>

      <GenerationDetailsDialog
        open={detailsOpen}
        generationId={detailsId}
        onOpenChange={handleCloseDetails}
        returnTo={returnTo}
      />
    </section>
  );
};
