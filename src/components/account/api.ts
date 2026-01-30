import type { ErrorResponse, GenerationDetailResponse, GenerationListResponse, GenerationQuotaResponse } from "@/types";
import type { AccountApiErrorVm, GenerationsListVm, GenerationsQueryVm, GenerationRowVm, QuotaVm } from "./types";
import { computeTotalPages, formatLocalDateTime, mapGenerationDtoToRowVm, toUrlSearchParams } from "./types";

const DEFAULT_TIMEOUT_MS = 10000;

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
