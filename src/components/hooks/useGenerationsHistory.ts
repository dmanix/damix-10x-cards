import { useCallback, useEffect, useMemo, useState } from "react";

import { getGenerations } from "@/components/account/api";
import type { AccountApiErrorVm, GenerationsHistoryStateVm, GenerationsQueryVm } from "@/components/account/types";
import { normalizeQuery, parseGenerationsQueryFromUrl, toUrlSearchParams } from "@/components/account/types";

const DEFAULT_QUERY = parseGenerationsQueryFromUrl("");

/**
 * Hook for managing and fetching generations history with pagination and filtering.
 *
 * @param returnTo - The URL to return to if the user is unauthorized.
 * @returns An object containing the query parameters, list state, fetching status, and functions to update the query and refetch data.
 */
export function useGenerationsHistory(returnTo = "/account") {
  const [query, setQuery] = useState<GenerationsQueryVm>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_QUERY;
    }

    return parseGenerationsQueryFromUrl(window.location.search);
  });
  const [listState, setListState] = useState<GenerationsHistoryStateVm>({ status: "idle" });
  const [isFetching, setIsFetching] = useState(false);
  const [refetchToken, setRefetchToken] = useState(0);

  /**
   * Updates the query parameters for fetching generations.
   * @param nextQuery - The new query parameters.
   */
  const updateQuery = useCallback((nextQuery: GenerationsQueryVm) => {
    setQuery(normalizeQuery(nextQuery));
  }, []);

  /**
   * Partially updates the query parameters for fetching generations.
   * @param patch - The partial query parameters to update.
   */
  const patchQuery = useCallback((patch: Partial<GenerationsQueryVm>) => {
    setQuery((prev) => normalizeQuery({ ...prev, ...patch }));
  }, []);

  /**
   * Refetches the generations data.
   */
  const refetch = useCallback(() => {
    setRefetchToken((token) => token + 1);
  }, []);

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
      setQuery(parseGenerationsQueryFromUrl(window.location.search));
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

    getGenerations(query, returnTo, controller.signal)
      .then((data) => {
        if (!isActive) {
          return;
        }

        const emptyKind = query.status === "all" ? "no_data" : "no_matches";

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
          error: error as AccountApiErrorVm,
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
    }),
    [query, updateQuery, patchQuery, listState, isFetching, refetch]
  );

  return value;
}