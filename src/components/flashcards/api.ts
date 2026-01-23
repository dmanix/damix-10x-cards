import type {
  CreateFlashcardsCommand,
  CreateFlashcardsResponse,
  ErrorResponse,
  FlashcardListResponse,
  FlashcardSource,
  UpdateFlashcardResponse,
} from "@/types";
import type { FlashcardsApiErrorVm, FlashcardsListVm, FlashcardsQueryVm } from "./types";
import { computeTotalPages, mapFlashcardDtoToCardVm, toUrlSearchParams } from "./types";

const DEFAULT_TIMEOUT_MS = 10000;

export interface UpdateFlashcardPayload {
  front?: string;
  back?: string;
  source: FlashcardSource;
}

function mapFlashcardsApiError(error: unknown, status?: number): FlashcardsApiErrorVm {
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
      message: message || "Nie znaleziono fiszki.",
      canRetry: false,
    };
  }

  if (status === 400) {
    return {
      kind: "validation",
      status,
      code,
      message: message || "Nieprawidłowe parametry. Sprawdź filtry i spróbuj ponownie.",
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

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const abortHandler = () => controller.abort();

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", abortHandler, { once: true });
    }
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener("abort", abortHandler);
    }
  }
}

function redirectToLogin(returnTo: string) {
  const encoded = encodeURIComponent(returnTo);
  window.location.href = `/auth/login?returnTo=${encoded}`;
}

export async function getFlashcards(
  query: FlashcardsQueryVm,
  returnTo = "/flashcards",
  signal?: AbortSignal
): Promise<FlashcardsListVm> {
  const queryString = toUrlSearchParams(query);

  let response: Response;
  try {
    response = await fetchWithTimeout(`/api/flashcards?${queryString}`, { method: "GET" }, DEFAULT_TIMEOUT_MS, signal);
  } catch (error) {
    throw mapFlashcardsApiError(error);
  }

  if (!response.ok) {
    if (response.status === 401) {
      redirectToLogin(returnTo);
      throw new Error("Unauthorized");
    }

    const payload = await readErrorPayload(response);
    throw mapFlashcardsApiError(payload, response.status);
  }

  const data: FlashcardListResponse = await response.json();
  const totalPages = computeTotalPages(data.total, data.pageSize);

  return {
    items: data.items.map(mapFlashcardDtoToCardVm),
    page: data.page,
    pageSize: data.pageSize,
    total: data.total,
    totalPages,
  };
}

export async function createManualFlashcard(
  front: string,
  back: string,
  returnTo = "/flashcards"
): Promise<CreateFlashcardsResponse> {
  const command: CreateFlashcardsCommand = {
    flashcards: [
      {
        front: front.trim(),
        back: back.trim(),
        source: "manual",
        generationId: null,
      },
    ],
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(
      "/api/flashcards",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
      },
      DEFAULT_TIMEOUT_MS
    );
  } catch (error) {
    throw mapFlashcardsApiError(error);
  }

  if (!response.ok) {
    if (response.status === 401) {
      redirectToLogin(returnTo);
      throw new Error("Unauthorized");
    }

    const payload = await readErrorPayload(response);
    throw mapFlashcardsApiError(payload, response.status);
  }

  return await response.json();
}

export async function updateFlashcard(
  id: string,
  payload: UpdateFlashcardPayload,
  returnTo = "/flashcards"
): Promise<UpdateFlashcardResponse> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      `/api/flashcards/${id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
      DEFAULT_TIMEOUT_MS
    );
  } catch (error) {
    throw mapFlashcardsApiError(error);
  }

  if (!response.ok) {
    if (response.status === 401) {
      redirectToLogin(returnTo);
      throw new Error("Unauthorized");
    }

    const payloadError = await readErrorPayload(response);
    throw mapFlashcardsApiError(payloadError, response.status);
  }

  return await response.json();
}

export async function deleteFlashcard(id: string, returnTo = "/flashcards"): Promise<void> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      `/api/flashcards/${id}`,
      {
        method: "DELETE",
      },
      DEFAULT_TIMEOUT_MS
    );
  } catch (error) {
    throw mapFlashcardsApiError(error);
  }

  if (!response.ok) {
    if (response.status === 401) {
      redirectToLogin(returnTo);
      throw new Error("Unauthorized");
    }

    if (response.status === 404) {
      return;
    }

    const payloadError = await readErrorPayload(response);
    throw mapFlashcardsApiError(payloadError, response.status);
  }
}
