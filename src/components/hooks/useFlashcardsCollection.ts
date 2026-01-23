import { useCallback, useEffect, useMemo, useState } from "react";

import { createManualFlashcard, deleteFlashcard, getFlashcards, updateFlashcard } from "@/components/flashcards/api";
import type { FlashcardsApiErrorVm, FlashcardsListStateVm, FlashcardsQueryVm } from "@/components/flashcards/types";
import type { FlashcardSource } from "@/types";
import { parseFlashcardsQueryFromUrl, toUrlSearchParams } from "@/components/flashcards/types";

const MIN_PAGE = 1;
const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 100;

const DEFAULT_QUERY = parseFlashcardsQueryFromUrl("");

function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function normalizeQuery(query: FlashcardsQueryVm): FlashcardsQueryVm {
  const trimmedSearch = query.search?.trim() ?? "";
  const searchValue = trimmedSearch.length > 0 ? trimmedSearch.slice(0, 200) : undefined;

  return {
    ...query,
    page: clampNumber(query.page, MIN_PAGE, Number.MAX_SAFE_INTEGER),
    pageSize: clampNumber(query.pageSize, MIN_PAGE_SIZE, MAX_PAGE_SIZE),
    search: searchValue,
  };
}

export function useFlashcardsCollection(returnTo = "/flashcards") {
  const [query, setQuery] = useState<FlashcardsQueryVm>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_QUERY;
    }

    return parseFlashcardsQueryFromUrl(window.location.search);
  });
  const [listState, setListState] = useState<FlashcardsListStateVm>({ status: "idle" });
  const [isFetching, setIsFetching] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdatingById, setIsUpdatingById] = useState<Record<string, boolean>>({});
  const [isDeletingById, setIsDeletingById] = useState<Record<string, boolean>>({});
  const [refetchToken, setRefetchToken] = useState(0);

  const updateQuery = useCallback((nextQuery: FlashcardsQueryVm) => {
    setQuery(normalizeQuery(nextQuery));
  }, []);

  const patchQuery = useCallback((patch: Partial<FlashcardsQueryVm>) => {
    setQuery((prev) => normalizeQuery({ ...prev, ...patch }));
  }, []);

  const refetch = useCallback(() => {
    setRefetchToken((token) => token + 1);
  }, []);

  const createManual = useCallback(
    async (front: string, back: string) => {
      setIsCreating(true);
      try {
        await createManualFlashcard(front, back, returnTo);
        setQuery((prev) =>
          normalizeQuery({
            ...prev,
            page: 1,
            sort: "updatedAt",
            order: "desc",
          })
        );
        refetch();
      } finally {
        setIsCreating(false);
      }
    },
    [refetch, returnTo]
  );

  const updateItem = useCallback(
    async (id: string, values: { front: string; back: string; source: FlashcardSource }) => {
      setIsUpdatingById((prev) => ({ ...prev, [id]: true }));
      try {
        return await updateFlashcard(
          id,
          {
            front: values.front.trim(),
            back: values.back.trim(),
            source: values.source,
          },
          returnTo
        );
      } finally {
        setIsUpdatingById((prev) => {
          return Object.fromEntries(Object.entries(prev).filter(([key]) => key !== id));
        });
      }
    },
    [returnTo]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      setIsDeletingById((prev) => ({ ...prev, [id]: true }));
      try {
        await deleteFlashcard(id, returnTo);
        refetch();
      } finally {
        setIsDeletingById((prev) => {
          return Object.fromEntries(Object.entries(prev).filter(([key]) => key !== id));
        });
      }
    },
    [refetch, returnTo]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const queryString = toUrlSearchParams(query);
    const nextUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    window.history.replaceState({}, "", nextUrl);
  }, [query]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handlePopState = () => {
      setQuery(parseFlashcardsQueryFromUrl(window.location.search));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    setIsFetching(true);
    setListState((prev) => ({
      status: "loading",
      data: prev.data,
    }));

    getFlashcards(query, returnTo, controller.signal)
      .then((data) => {
        if (!isActive) {
          return;
        }

        const hasFilters = Boolean(query.search) || Boolean(query.source);
        const emptyKind = hasFilters ? "no_matches" : "no_data";

        if (data.items.length === 0 && data.total > 0 && query.page > data.totalPages) {
          setQuery((prev) => normalizeQuery({ ...prev, page: data.totalPages }));
          return;
        }

        if (data.total === 0) {
          setListState({
            status: "empty",
            data,
            emptyKind,
          });
          return;
        }

        setListState({
          status: "success",
          data,
        });
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        if (error instanceof Error && error.message === "Unauthorized") {
          return;
        }

        setListState({
          status: "error",
          error: error as FlashcardsApiErrorVm,
        });
      })
      .finally(() => {
        if (!isActive) {
          return;
        }
        setIsFetching(false);
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [query, refetchToken, returnTo]);

  const value = useMemo(
    () => ({
      query,
      setQuery: updateQuery,
      patchQuery,
      listState,
      isFetching,
      refetch,
      createManual,
      updateItem,
      deleteItem,
      createDialogOpen,
      setCreateDialogOpen,
      editingId,
      setEditingId,
      deleteTargetId,
      setDeleteTargetId,
      isCreating,
      isUpdatingById,
      isDeletingById,
    }),
    [
      query,
      updateQuery,
      patchQuery,
      listState,
      isFetching,
      refetch,
      createManual,
      updateItem,
      deleteItem,
      createDialogOpen,
      editingId,
      deleteTargetId,
      isCreating,
      isUpdatingById,
      isDeletingById,
    ]
  );

  return value;
}
