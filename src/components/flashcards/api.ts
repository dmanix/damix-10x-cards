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

/**
 * Maps an unknown error to a FlashcardsApiErrorVm.
 * @param {unknown} error The error to map.
 * @param {number} [status] The HTTP status code of the response.
 * @returns {FlashcardsApiErrorVm} The mapped error.
 */
export function mapFlashcardsApiError(error: unknown, status?: number): FlashcardsApiErrorVm {
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

/**
 * Reads the error payload from a Response object.
 * @param {Response} response The Response object to read from.
 * @returns {Promise<ErrorResponse | undefined>} The error payload, or undefined if an error occurred.
 */
async function readErrorPayload(response: Response): Promise<ErrorResponse | undefined> {
  try {
    return (await response.json()) as ErrorResponse;
  } catch {
    return undefined;
  }
}

/**
 * Fetches a resource with a timeout.
 *
 * @async
 * @param {RequestInfo | URL} input - The resource to fetch.
 * @param {RequestInit} init - The fetch options.
 * @param {number} [timeoutMs=DEFAULT_TIMEOUT_MS] - The timeout in milliseconds.
 * @param {AbortSignal} [signal] - An optional AbortSignal to externally control the fetch.
 * @returns {Promise<Response>} A promise that resolves to the response from the fetch.
 * @throws {DOMException} If the fetch is aborted due to a timeout or an external abort signal.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const abortHandler = () => controller.abort();

  // If an external signal is already aborted, ensure our controller is aborted too.
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", abortHandler, { once: true });
    }
  }

  const fetchPromise = fetch(input, { ...init, signal: controller.signal });

  // Create a timeout promise that aborts the controller and rejects with a DOMException
  // containing the 'AbortError' text so callers can reliably match on it.
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<Response>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      // Abort the in-flight fetch so implementations that listen to the signal will react.
      controller.abort();
      // Reject with a DOMException whose message includes 'AbortError' to match tests/consumers.
      reject(new DOMException("AbortError", "AbortError"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (err: unknown) {
    // Normalize abort-related errors so callers/tests can reliably match on "AbortError".
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
 * Retrieves flashcards based on the provided query parameters.
 * @async
 * @param {FlashcardsQueryVm} query - The query parameters for filtering flashcards.
 * @param {string} [returnTo="/flashcards"] - The URL to redirect to if the user is not authorized.
 * @param {AbortSignal} [signal] - An optional AbortSignal to cancel the request.
 * @returns {Promise<FlashcardsListVm>} A promise that resolves to the list of flashcards.
 * @throws {Error} If the user is not authorized.
 * @throws {FlashcardsApiErrorVm} If there is an API error.
 */
export async function getFlashcards(
  query: FlashcardsQueryVm,
  returnTo = "/flashcards",
  signal?: AbortSignal
): Promise<FlashcardsListVm> {
  const queryString = toUrlSearchParams(query);

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `/api/flashcards?${queryString}`,
      { method: "GET", credentials: "same-origin" },
      DEFAULT_TIMEOUT_MS,
      signal
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

/**
 * Creates a manual flashcard.
 * @async
 * @param {string} front - The front text of the flashcard.
 * @param {string} back - The back text of the flashcard.
 * @param {string} [returnTo="/flashcards"] - The URL to redirect to if the user is not authorized.
 * @returns {Promise<CreateFlashcardsResponse>} A promise that resolves to the create flashcards response.
 * @throws {Error} If the user is not authorized.
 * @throws {FlashcardsApiErrorVm} If there is an API error.
 */
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
        credentials: "same-origin",
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

/**
 * Updates a flashcard with the given ID.
 * @async
 * @param {string} id - The ID of the flashcard to update.
 * @param {UpdateFlashcardPayload} payload - The data to update the flashcard with.
 * @param {string} [returnTo="/flashcards"] - The URL to redirect to if the user is not authorized.
 * @returns {Promise<UpdateFlashcardResponse>} A promise that resolves to the update flashcard response.
 * @throws {Error} If the user is not authorized.
 * @throws {FlashcardsApiErrorVm} If there is an API error.
 */
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
        credentials: "same-origin",
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

/**
 * Deletes a flashcard with the given ID.
 * @async
 * @param {string} id - The ID of the flashcard to delete.
 * @param {string} [returnTo="/flashcards"] - The URL to redirect to if the user is not authorized.
 * @returns {Promise<void>} A promise that resolves when the flashcard is deleted.
 * @throws {Error} If the user is not authorized.
 * @throws {FlashcardsApiErrorVm} If there is an API error.
 */
export async function deleteFlashcard(id: string, returnTo = "/flashcards"): Promise<void> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      `/api/flashcards/${id}`,
      {
        method: "DELETE",
        credentials: "same-origin",
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