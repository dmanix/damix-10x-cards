import { useEffect, useId, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import type { FlashcardsQueryVm, FlashcardsSortOptionVm, FlashcardSourceFilterVm } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SortOption {
  value: FlashcardsSortOptionVm;
  label: string;
  sort: FlashcardsQueryVm["sort"];
  order: FlashcardsQueryVm["order"];
}

interface SourceOption {
  value: FlashcardSourceFilterVm;
  label: string;
}

interface FlashcardsToolbarProps {
  query: FlashcardsQueryVm;
  onQueryChange: (next: FlashcardsQueryVm) => void;
  onOpenCreate: () => void;
  onResetFilters: () => void;
  isBusy?: boolean;
}

const SEARCH_LIMIT = 200;

export function FlashcardsToolbar({
  query,
  onQueryChange,
  onOpenCreate,
  onResetFilters,
  isBusy = false,
}: FlashcardsToolbarProps) {
  const searchId = useId();
  const [searchValue, setSearchValue] = useState(query.search ?? "");
  const [searchError, setSearchError] = useState<string | null>(null);

  const sortOptions = useMemo<SortOption[]>(
    () => [
      {
        value: "updated_desc",
        label: "Ostatnio aktualizowane",
        sort: "updatedAt",
        order: "desc",
      },
      {
        value: "created_desc",
        label: "Najnowsze",
        sort: "createdAt",
        order: "desc",
      },
      {
        value: "created_asc",
        label: "Najstarsze",
        sort: "createdAt",
        order: "asc",
      },
    ],
    []
  );

  const sourceOptions = useMemo<SourceOption[]>(
    () => [
      { value: "all", label: "Wszystkie" },
      { value: "ai", label: "AI" },
      { value: "ai-edited", label: "AI (edytowane)" },
      { value: "manual", label: "Manualne" },
    ],
    []
  );

  const selectedSort = useMemo<FlashcardsSortOptionVm>(() => {
    const option = sortOptions.find((item) => item.sort === query.sort && item.order === query.order);
    return option?.value ?? "updated_desc";
  }, [query.order, query.sort, sortOptions]);

  useEffect(() => {
    setSearchValue(query.search ?? "");
  }, [query.search]);

  useEffect(() => {
    const trimmed = searchValue.trim();

    if (trimmed.length > SEARCH_LIMIT) {
      setSearchError(`Maksymalnie ${SEARCH_LIMIT} znaków.`);
      return undefined;
    }

    setSearchError(null);

    const debounce = setTimeout(() => {
      const nextSearch = trimmed.length > 0 ? trimmed : undefined;
      const currentSearch = query.search ?? undefined;

      if (nextSearch === currentSearch) {
        return;
      }

      onQueryChange({
        ...query,
        page: 1,
        search: nextSearch,
      });
    }, 400);

    return () => clearTimeout(debounce);
  }, [onQueryChange, query, searchValue]);

  const handleSourceChange = (value: string) => {
    const normalized = value === "all" ? undefined : (value as FlashcardSourceFilterVm);
    onQueryChange({
      ...query,
      page: 1,
      source: normalized as FlashcardsQueryVm["source"],
    });
  };

  const handleSortChange = (value: string) => {
    const option = sortOptions.find((item) => item.value === value);
    if (!option) {
      return;
    }

    onQueryChange({
      ...query,
      page: 1,
      sort: option.sort,
      order: option.order,
    });
  };

  const handleClearSearch = () => {
    setSearchValue("");
    onQueryChange({
      ...query,
      page: 1,
      search: undefined,
    });
  };

  return (
    <section role="search" aria-label="Wyszukiwanie i filtry fiszek" className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_220px_auto] md:items-end">
        <div className="space-y-1">
          <label htmlFor={searchId} className="text-xs text-muted-foreground">
            Szukaj
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={searchId}
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Szukaj po treści fiszki"
              className="pl-9 pr-10"
              aria-describedby={searchError ? `${searchId}-error` : undefined}
              aria-invalid={Boolean(searchError)}
              disabled={isBusy}
            />
            {searchValue.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={handleClearSearch}
                aria-label="Wyczyść wyszukiwanie"
                disabled={isBusy}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
          {searchError ? (
            <p id={`${searchId}-error`} className="text-xs text-destructive" role="alert">
              {searchError}
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Źródło</span>
          <Select value={query.source ?? "all"} onValueChange={handleSourceChange} disabled={isBusy}>
            <SelectTrigger>
              <SelectValue placeholder="Wszystkie" />
            </SelectTrigger>
            <SelectContent>
              {sourceOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Sortowanie</span>
          <Select value={selectedSort} onValueChange={handleSortChange} disabled={isBusy}>
            <SelectTrigger>
              <SelectValue placeholder="Ostatnio aktualizowane" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end gap-2">
          <Button type="button" onClick={onOpenCreate} disabled={isBusy} data-test-id="flashcards-add-button">
            Dodaj nową fiszkę
          </Button>
          <Button type="button" variant="outline" onClick={onResetFilters} disabled={isBusy}>
            Wyczyść filtry
          </Button>
        </div>
      </div>
    </section>
  );
}
