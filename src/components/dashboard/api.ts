import type { FlashcardListResponse, GenerationListResponse } from "@/types";
import type { DashboardApiErrorVm, RecentFlashcardsVm, RecentGenerationsVm } from "./types";
import { mapFlashcardDtoToRecentVm, mapGenerationDtoToRecentVm } from "./types";

/**
 * Type guard to check if an error object has a message property of type string.
 * @param error - The error object to check.
 * @returns True if the error object has a message property of type string, false otherwise.
 */
function hasErrorMessage(error: unknown): error is { message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  );
}

/**
 * Maps an unknown error to a DashboardApiErrorVm object.
 * @param error - The error to map.
 * @param status - The HTTP status code, if available.
 * @returns A DashboardApiErrorVm object representing the error.
 */
function mapDashboardApiError(error: unknown, status?: number): DashboardApiErrorVm {
  if (status === 401) {
    return {
      kind: "unauthorized",
      status,
      message: "Sesja wygasła. Zaloguj się ponownie.",
      canRetry: false,
    };
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      kind: "timeout",
      message: "Problem z połączeniem. Sprawdź internet i spróbuj ponownie.",
      canRetry: true,
    };
  }

  if (status === 400) {
    return {
      kind: "http",
      status,
      message: "Nie udało się pobrać danych (nieprawidłowe parametry). Spróbuj ponownie.",
      canRetry: true,
    };
  }

  if (status && status >= 500) {
    return {
      kind: "http",
      status,
      message: "Wystąpił błąd serwera. Spróbuj ponownie.",
      canRetry: true,
    };
  }

  return {
    kind: "unknown",
    status,
    message: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.",
    canRetry: true,
  };
}

/**
 * Fetches data from a URL with a timeout.
 * @param input - The URL to fetch.
 * @param init - The request initialization options.
 * @param timeoutMs - The timeout in milliseconds.
 * @returns A promise that resolves to the response.
 */
async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Retrieves the most recent flashcards.
 * @returns A promise that resolves to a RecentFlashcardsVm object.
 * @throws {DashboardApiErrorVm} - If an API error occurs.
 */
export async function getRecentFlashcards(): Promise<RecentFlashcardsVm> {
  // page=1, pageSize=5, sort=updatedAt, order=desc
  try {
    const response = await fetchWithTimeout(
      "/api/flashcards?page=1&pageSize=5&sort=updatedAt&order=desc",
      { method: "GET", credentials: "same-origin" },
      10000
    );

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = "/auth/login?returnTo=/dashboard";
        throw new Error("Unauthorized");
      }
      throw await response.json().catch(() => ({}));
    }

    const data: FlashcardListResponse = await response.json();
    return {
      items: data.items.map(mapFlashcardDtoToRecentVm),
      total: data.total,
    };
  } catch (error) {
    if (hasErrorMessage(error) && error.message === "Unauthorized") throw error;
    // Mapujemy błąd i rzucamy jako DashboardApiErrorVm
    throw mapDashboardApiError(error);
  }
}

/**
 * Retrieves the most recent generations.
 * @returns A promise that resolves to a RecentGenerationsVm object.
 * @throws {DashboardApiErrorVm} - If an API error occurs.
 */
export async function getRecentGenerations(): Promise<RecentGenerationsVm> {
  // page=1, pageSize=5, sort=createdAt, order=desc
  try {
    const response = await fetchWithTimeout(
      "/api/generations?page=1&pageSize=5&sort=createdAt&order=desc",
      { method: "GET", credentials: "same-origin" },
      10000
    );

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = "/auth/login?returnTo=/dashboard";
        throw new Error("Unauthorized");
      }
      throw await response.json().catch(() => ({}));
    }

    const data: GenerationListResponse = await response.json();
    return {
      items: data.items.map(mapGenerationDtoToRecentVm),
      total: data.total,
    };
  } catch (error) {
    if (hasErrorMessage(error) && error.message === "Unauthorized") throw error;
    throw mapDashboardApiError(error);
  }
}