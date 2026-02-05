import type { FlashcardDto, FlashcardSource } from "@/types";

export type FlashcardsViewStatus = "idle" | "loading" | "success" | "empty" | "error";

export type FlashcardsSortOptionVm = "updated_desc" | "created_desc" | "created_asc";

export type FlashcardSourceFilterVm = "all" | FlashcardSource;

export interface FlashcardsQueryVm {
  page: number;
  pageSize: number;
  sort: "createdAt" | "updatedAt";
  order: "asc" | "desc";
  source?: FlashcardSource;
  search?: string;
}

export interface FlashcardsListVm {
  items: FlashcardCardVm[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface FlashcardCardVm {
  id: string;
  front: string;
  back: string;
  source: FlashcardSource;
  createdAt: string;
  updatedAt: string;
  createdAtLabel: string;
  updatedAtLabel: string;
}

export interface FlashcardsApiErrorVm {
  kind: "unauthorized" | "validation" | "not_found" | "network" | "timeout" | "server" | "unknown";
  status?: number;
  code?: string;
  message: string;
  canRetry: boolean;
  action?: { type: "link"; href: string; label: string };
}

export interface FlashcardsListStateVm {
  status: FlashcardsViewStatus;
  data?: FlashcardsListVm;
  error?: FlashcardsApiErrorVm;
  emptyKind?: "no_data" | "no_matches";
}

export interface FlashcardEditDraftVm {
  front: string;
  back: string;
  frontError?: string;
  backError?: string;
  isDirty: boolean;
  isValid: boolean;
}

const DEFAULT_QUERY: FlashcardsQueryVm = {
  page: 1,
  pageSize: 20,
  sort: "updatedAt",
  order: "desc",
};

const SOURCE_VALUES: FlashcardSource[] = ["ai", "ai-edited", "manual"];
const SORT_VALUES: FlashcardsQueryVm["sort"][] = ["createdAt", "updatedAt"];
const ORDER_VALUES: FlashcardsQueryVm["order"][] = ["asc", "desc"];

/**
 * Clamps a number within a specified range.
 *
 * @param value The number to clamp.
 * @param min The minimum allowed value.
 * @param max The maximum allowed value.
 * @returns The clamped number.
 */
function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

/**
 * Parses a flashcards query object from a URL search string.
 *
 * @param search The URL search string.
 * @returns The parsed flashcards query object.
 */
export function parseFlashcardsQueryFromUrl(search: string): FlashcardsQueryVm {
  const params = new URLSearchParams(search);
  const pageParam = Number.parseInt(params.get("page") ?? "", 10);
  const pageSizeParam = Number.parseInt(params.get("pageSize") ?? "", 10);
  const page = Number.isNaN(pageParam) ? DEFAULT_QUERY.page : clampNumber(pageParam, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = Number.isNaN(pageSizeParam) ? DEFAULT_QUERY.pageSize : clampNumber(pageSizeParam, 1, 100);
  const sortParam = params.get("sort") ?? undefined;
  const orderParam = params.get("order") ?? undefined;
  const sourceParam = params.get("source") ?? undefined;
  const rawSearch = params.get("search") ?? "";
  const trimmedSearch = rawSearch.trim();
  const searchValue = trimmedSearch.length > 0 ? trimmedSearch.slice(0, 200) : undefined;

  return {
    page: page || DEFAULT_QUERY.page,
    pageSize: pageSize || DEFAULT_QUERY.pageSize,
    sort: SORT_VALUES.includes(sortParam as FlashcardsQueryVm["sort"])
      ? (sortParam as FlashcardsQueryVm["sort"])
      : DEFAULT_QUERY.sort,
    order: ORDER_VALUES.includes(orderParam as FlashcardsQueryVm["order"])
      ? (orderParam as FlashcardsQueryVm["order"])
      : DEFAULT_QUERY.order,
    source: SOURCE_VALUES.includes(sourceParam as FlashcardSource) ? (sourceParam as FlashcardSource) : undefined,
    search: searchValue,
  };
}

/**
 * Converts a flashcards query object to a URL search parameters string.
 *
 * @param query The flashcards query object.
 * @returns The URL search parameters string.
 */
export function toUrlSearchParams(query: FlashcardsQueryVm): string {
  const params = new URLSearchParams();

  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  params.set("sort", query.sort);
  params.set("order", query.order);

  if (query.source) {
    params.set("source", query.source);
  }

  if (query.search) {
    params.set("search", query.search.trim());
  }

  return params.toString();
}

/**
 * Maps a FlashcardDto object to a FlashcardCardVm object.
 *
 * @param dto The FlashcardDto object to map.
 * @returns The mapped FlashcardCardVm object.
 */
export function mapFlashcardDtoToCardVm(dto: FlashcardDto): FlashcardCardVm {
  return {
    id: dto.id,
    front: dto.front,
    back: dto.back,
    source: dto.source,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    createdAtLabel: new Date(dto.createdAt).toLocaleString("pl-PL"),
    updatedAtLabel: new Date(dto.updatedAt).toLocaleString("pl-PL"),
  };
}

/**
 * Computes the total number of pages based on the total number of items and the page size.
 *
 * @param total The total number of items.
 * @param pageSize The number of items per page.
 * @returns The total number of pages.
 */
export function computeTotalPages(total: number, pageSize: number) {
  if (total <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(total / pageSize));
}