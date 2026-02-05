import type { ErrorResponse, GenerationDetailResponse, GenerationListResponse, GenerationQuotaResponse } from "@/types";
import type { AccountApiErrorVm, GenerationsListVm, GenerationsQueryVm, GenerationRowVm, QuotaVm } from "./types";
import { computeTotalPages, formatLocalDateTime, mapGenerationDtoToRowVm, toUrlSearchParams } from "./types";

const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Maps an unknown error to a standardized `AccountApiErrorVm` for consistent error handling.
 *
 * @param error The error object to map. Can be of any type.
 * @param status The HTTP status code associated with the error, if available.
 * @returns A standardized `AccountApiErrorVm` representing the error.
 */
export function mapAccountApiError(error: unknown, status?: number): AccountApiErrorVm {
  const errorResponse = error as ErrorResponse | undefined;
  const message = errorResponse?.message;
  const code = errorResponse?.code;

  if (status === 401) {
    return {
      kind: "unauthorized",
      status,
      code,
      message: "Sesja wygasła. Zaloguj się ponownie.",
      canRetry: false,
    };
  }

  if (status === 404) {
    return {
      kind: "not_found",
      status,
      code,
      message: message || "Nie znaleziono generacji.",
      canRetry: false,
    };
  }

  if (status === 400) {
    return {
      kind: "validation",
      status,
      code,
      message: message || "Nieprawidłowe parametry filtrowania. Przywróć ustawienia domyślne.",
      canRetry: true,
    };
  }

  if (status && status >= 500) {
    return {
      kind: "server",
      status,
      code,
      message: message || "Wystąpił błąd serwera. Spróbuj ponownie.",
      canRetry: true,
    };
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      kind: "timeout",
      message: "Problem z połączeniem. Sprawdź internet i spróbuj ponownie.",
      canRetry: true,
    };
  }

  if (error instanceof TypeError) {
    return {
      kind: "network",
      message: "Problem z połączeniem. Sprawdź internet i spróbuj ponownie.",
      canRetry: true,
    };
  }

  return {
    kind: "unknown",
    status,
    code,
    message: message || "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.",
    canRetry: true,
  };
}

async function readErrorPayload(response: Response): Promise<ErrorResponse | undefined> {
  try {
    return (await response.json()) as ErrorResponse;
  } catch {
    return undefined;
  }
}

/**
 * A wrapper around the `fetch` API that adds a timeout.
 *
 * @param input The URL to fetch.
 * @param init The `fetch` init object.
 * @param timeoutMs The timeout in milliseconds.
 * @param signal An optional AbortSignal to allow cancellation of the request.
 * @returns A promise that resolves with the response, or rejects with an error.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const abortHandler = () => controller.abort();

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", abortHandler, { once: true });
    }
  }

  const fetchPromise = fetch(input, { ...init, signal: controller.signal });

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<Response>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new DOMException("AbortError", "AbortError"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (err: unknown) {
    const asString = typeof err === "string" ? err : err instanceof Error ? err.message : String(err);
    if ((err instanceof DOMException && err.name === "AbortError") || /Abort/i.test(asString)) {
      throw new DOMException("AbortError", "AbortError");
    }
    throw err;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    if (signal) {
      signal.removeEventListener("abort", abortHandler);
    }
  }
}

function redirectToLogin(returnTo: string) {
  const encoded = encodeURIComponent(returnTo);
  window.location.href = `/auth/login?returnTo=${encoded}`;
}

/**
 * Retrieves the generation quota for the current user.
 *
 * @param returnTo The URL to redirect to if the user is not authenticated.
 * @returns A promise that resolves with the generation quota.
 */
export async function getGenerationQuota(returnTo = "/account"): Promise<QuotaVm> {
  let response: Response;
  try {
    response = await fetchWithTimeout("/api/generations/quota", { method: "GET", credentials: "same-origin" });
  } catch (error) {
    throw mapAccountApiError(error);
  }

  if (!response.ok) {
    if (response.status === 401) {
      redirectToLogin(returnTo);
      throw new Error("Unauthorized");
    }

    const payload = await readErrorPayload(response);
    throw mapAccountApiError(payload, response.status);
  }

  const data: GenerationQuotaResponse = await response.json();
  const remaining = Math.max(0, data.remaining ?? 0);
  const limit = Math.max(0, data.limit ?? 0);

  return {
    remaining,
    limit,
    resetsAtUtc: data.resetsAtUtc,
    resetsAtLocalLabel: formatLocalDateTime(data.resetsAtUtc, "Nieznany czas resetu"),
    isExhausted: remaining <= 0,
  };
}

/**
 * Retrieves a list of generations based on the provided query.
 *
 * @param query The query parameters for filtering generations.
 * @param returnTo The URL to redirect to if the user is not authenticated.
 * @param signal An optional AbortSignal to allow cancellation of the request.
 * @returns A promise that resolves with a list of generations.
 */
export async function getGenerations(
  query: GenerationsQueryVm,
  returnTo = "/account",
  signal?: AbortSignal
): Promise<GenerationsListVm> {
  const queryString = toUrlSearchParams(query);

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `/api/generations?${queryString}`,
      { method: "GET", credentials: "same-origin" },
      DEFAULT_TIMEOUT_MS,
      signal
    );
  } catch (error) {
    throw mapAccountApiError(error);
  }

  if (!response.ok) {
    if (response.status === 401) {
      redirectToLogin(returnTo);
      throw new Error("Unauthorized");
    }

    const payload = await readErrorPayload(response);
    throw mapAccountApiError(payload, response.status);
  }

  const data: GenerationListResponse = await response.json();
  const totalPages = computeTotalPages(data.total, data.pageSize);

  return {
    items: data.items.map(mapGenerationDtoToRowVm),
    page: data.page,
    pageSize: data.pageSize,
    total: data.total,
    totalPages,
  };
}

/**
 * Retrieves the details of a specific generation.
 *
 * @param id The ID of the generation to retrieve.
 * @param returnTo The URL to redirect to if the user is not authenticated.
 * @returns A promise that resolves with the details of the generation.
 */
export async function getGenerationDetail(id: string, returnTo = "/account"): Promise<GenerationRowVm> {
  let response: Response;
  try {
    response = await fetchWithTimeout(`/api/generations/${id}`, { method: "GET", credentials: "same-origin" });
  } catch (error) {
    throw mapAccountApiError(error);
  }

  if (!response.ok) {
    if (response.status === 401) {
      redirectToLogin(returnTo);
      throw new Error("Unauthorized");
    }

    const payload = await readErrorPayload(response);
    throw mapAccountApiError(payload, response.status);
  }

  const data: GenerationDetailResponse = await response.json();
  return mapGenerationDtoToRowVm(data);
}