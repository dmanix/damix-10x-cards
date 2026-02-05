import type { GenerationDto, GenerationStatus } from "@/types";

export type GenerationStatusFilterVm = "all" | "pending" | "succeeded" | "failed";
export type GenerationsSortVm = "createdAt" | "finishedAt";
export type GenerationsOrderVm = "desc" | "asc";

export interface GenerationsQueryVm {
  status: GenerationStatusFilterVm;
  page: number;
  pageSize: number;
  sort: GenerationsSortVm;
  order: GenerationsOrderVm;
}

export interface GenerationRowVm {
  id: string;
  status: "pending" | "succeeded" | "failed";
  createdAt: string;
  createdAtLabel: string;
  finishedAt: string | null;
  finishedAtLabel: string | null;
  generatedCount: number | null;
  acceptedTotalCount: number;
  acceptedOriginalCount: number | null;
  acceptedEditedCount: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  errorMessageShort: string | null;
}

export interface GenerationsListVm {
  items: GenerationRowVm[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface QuotaVm {
  remaining: number;
  limit: number;
  resetsAtUtc: string;
  resetsAtLocalLabel: string;
  isExhausted: boolean;
}

export type AsyncStatus = "idle" | "loading" | "success" | "empty" | "error";

export interface AccountApiErrorVm {
  kind: "unauthorized" | "validation" | "not_found" | "network" | "timeout" | "server" | "unknown";
  status?: number;
  code?: string;
  message: string;
  canRetry: boolean;
  action?: { type: "link"; href: string; label: string };
}

export interface QuotaStateVm {
  status: "idle" | "loading" | "success" | "error";
  data?: QuotaVm;
  error?: AccountApiErrorVm;
}

export interface GenerationsHistoryStateVm {
  status: AsyncStatus;
  data?: GenerationsListVm;
  error?: AccountApiErrorVm;
  emptyKind?: "no_data" | "no_matches";
}

export interface GenerationDetailStateVm {
  status: "idle" | "loading" | "success" | "error";
  data?: GenerationRowVm;
  error?: AccountApiErrorVm;
}

const DEFAULT_QUERY: GenerationsQueryVm = {
  status: "all",
  page: 1,
  pageSize: 20,
  sort: "createdAt",
  order: "desc",
};

const STATUS_VALUES: GenerationStatus[] = ["pending", "succeeded", "failed"];
const SORT_VALUES: GenerationsQueryVm["sort"][] = ["createdAt", "finishedAt"];
const ORDER_VALUES: GenerationsQueryVm["order"][] = ["desc", "asc"];

/**
 * Clamps a number between a minimum and maximum value.
 * @param {number} value The number to clamp.
 * @param {number} min The minimum value.
 * @param {number} max The maximum value.
 * @returns {number} The clamped number.
 */
function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

/**
 * Converts a string to a GenerationStatusFilterVm.
 * @param {string | null} value The string to convert.
 * @returns {GenerationStatusFilterVm} The converted GenerationStatusFilterVm.
 */
function toStatusFilter(value: string | null): GenerationStatusFilterVm {
  if (value && STATUS_VALUES.includes(value as GenerationStatus)) {
    return value as GenerationStatusFilterVm;
  }

  return "all";
}

/**
 * Parses a GenerationsQueryVm from a URL search string.
 * @param {string} search The URL search string.
 * @returns {GenerationsQueryVm} The parsed GenerationsQueryVm.
 */
export function parseGenerationsQueryFromUrl(search: string): GenerationsQueryVm {
  const params = new URLSearchParams(search);
  const pageParam = Number.parseInt(params.get("page") ?? "", 10);
  const pageSizeParam = Number.parseInt(params.get("pageSize") ?? "", 10);
  const page = Number.isNaN(pageParam) ? DEFAULT_QUERY.page : clampNumber(pageParam, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = Number.isNaN(pageSizeParam) ? DEFAULT_QUERY.pageSize : clampNumber(pageSizeParam, 1, 100);
  const sortParam = params.get("sort") ?? undefined;
  const orderParam = params.get("order") ?? undefined;
  const status = toStatusFilter(params.get("status"));

  return {
    status,
    page: page || DEFAULT_QUERY.page,
    pageSize: pageSize || DEFAULT_QUERY.pageSize,
    sort: SORT_VALUES.includes(sortParam as GenerationsQueryVm["sort"])
      ? (sortParam as GenerationsQueryVm["sort"])
      : DEFAULT_QUERY.sort,
    order: ORDER_VALUES.includes(orderParam as GenerationsQueryVm["order"])
      ? (orderParam as GenerationsQueryVm["order"])
      : DEFAULT_QUERY.order,
  };
}

/**
 * Normalizes a GenerationsQueryVm.
 * @param {GenerationsQueryVm} query The GenerationsQueryVm to normalize.
 * @returns {GenerationsQueryVm} The normalized GenerationsQueryVm.
 */
export function normalizeQuery(query: GenerationsQueryVm): GenerationsQueryVm {
  return {
    ...query,
    status: toStatusFilter(query.status === "all" ? "all" : query.status),
    page: clampNumber(query.page, 1, Number.MAX_SAFE_INTEGER),
    pageSize: clampNumber(query.pageSize, 1, 100),
    sort: SORT_VALUES.includes(query.sort) ? query.sort : DEFAULT_QUERY.sort,
    order: ORDER_VALUES.includes(query.order) ? query.order : DEFAULT_QUERY.order,
  };
}

/**
 * Converts a GenerationsQueryVm to a URL search string.
 * @param {GenerationsQueryVm} query The GenerationsQueryVm to convert.
 * @returns {string} The URL search string.
 */
export function toUrlSearchParams(query: GenerationsQueryVm): string {
  const params = new URLSearchParams();

  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  params.set("sort", query.sort);
  params.set("order", query.order);

  if (query.status !== "all") {
    params.set("status", query.status);
  }

  return params.toString();
}

/**
 * Computes the total number of pages.
 * @param {number} total The total number of items.
 * @param {number} pageSize The number of items per page.
 * @returns {number} The total number of pages.
 */
export function computeTotalPages(total: number, pageSize: number) {
  if (total <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * Formats a UTC ISO string to a localized date and time string.
 * @param {string | null} isoUtc The UTC ISO string to format.
 * @param {string} [fallback="—"] The fallback string to use if the ISO string is null or invalid.
 * @returns {string} The formatted date and time string.
 */
export function formatLocalDateTime(isoUtc: string | null, fallback = "—") {
  if (!isoUtc) {
    return fallback;
  }

  const date = new Date(isoUtc);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/**
 * Truncates a message to a specified limit.
 * @param {string | null | undefined} value The message to truncate.
 * @param {number} [limit=120] The maximum length of the message.
 * @returns {string | null} The truncated message, or null if the input is null or undefined.
 */
function truncateMessage(value: string | null | undefined, limit = 120): string | null {
  if (!value) {
    return null;
  }

  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(0, limit - 3))}...`;
}

/**
 * Maps a GenerationDto to a GenerationRowVm.
 * @param {GenerationDto} dto The GenerationDto to map.
 * @returns {GenerationRowVm} The mapped GenerationRowVm.
 */
export function mapGenerationDtoToRowVm(dto: GenerationDto): GenerationRowVm {
  const acceptedOriginal = dto.acceptedOriginalCount ?? 0;
  const acceptedEdited = dto.acceptedEditedCount ?? 0;

  return {
    id: dto.id,
    status: dto.status as GenerationRowVm["status"],
    createdAt: dto.createdAt,
    createdAtLabel: formatLocalDateTime(dto.createdAt),
    finishedAt: dto.finishedAt,
    finishedAtLabel: dto.finishedAt ? formatLocalDateTime(dto.finishedAt) : "—",
    generatedCount: dto.generatedCount ?? null,
    acceptedTotalCount: acceptedOriginal + acceptedEdited,
    acceptedOriginalCount: dto.acceptedOriginalCount ?? null,
    acceptedEditedCount: dto.acceptedEditedCount ?? null,
    errorCode: dto.error?.code ?? null,
    errorMessage: dto.error?.message ?? null,
    errorMessageShort: truncateMessage(dto.error?.message ?? null),
  };
}