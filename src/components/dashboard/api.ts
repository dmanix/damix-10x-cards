import type { FlashcardListResponse, GenerationListResponse } from "@/types";
import type { DashboardApiErrorVm, RecentFlashcardsVm, RecentGenerationsVm } from "./types";
import { mapFlashcardDtoToRecentVm, mapGenerationDtoToRecentVm } from "./types";

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

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getRecentFlashcards(): Promise<RecentFlashcardsVm> {
  // page=1, pageSize=5, sort=updatedAt, order=desc
  try {
    const response = await fetchWithTimeout(
      "/api/flashcards?page=1&pageSize=5&sort=updatedAt&order=desc",
      { method: "GET" },
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
    if ((error as any)?.message === "Unauthorized") throw error;
    // Mapujemy błąd i rzucamy jako DashboardApiErrorVm
    throw mapDashboardApiError(error);
  }
}

export async function getRecentGenerations(): Promise<RecentGenerationsVm> {
  // page=1, pageSize=5, sort=createdAt, order=desc
  try {
    const response = await fetchWithTimeout(
      "/api/generations?page=1&pageSize=5&sort=createdAt&order=desc",
      { method: "GET" },
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
    if ((error as any)?.message === "Unauthorized") throw error;
    throw mapDashboardApiError(error);
  }
}
