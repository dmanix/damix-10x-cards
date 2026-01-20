import type {
  GenerationCreateCommand,
  GenerationStartResponse,
  CreateFlashcardsCommand,
  CreateFlashcardsResponse,
} from "@/types";
import type { ApiErrorVm } from "./types";

/**
 * Mapuje błąd HTTP na ApiErrorVm
 */
export async function mapApiError(response: Response): Promise<ApiErrorVm> {
  let errorData: { code?: string; message?: string; remaining?: number; limit?: number; resetsAtUtc?: string } = {};

  try {
    errorData = await response.json();
  } catch {
    // Jeśli nie można sparsować JSON, użyj domyślnego komunikatu
  }

  const status = response.status;
  const code = errorData.code || "unknown";

  // Mapowanie kodów błędów na przyjazne komunikaty
  switch (status) {
    case 400:
      return {
        kind: "validation",
        status,
        code,
        message: errorData.message || "Nieprawidłowy tekst wejściowy. Sprawdź długość (1000–20000 znaków).",
        canRetry: false,
      };

    case 403:
      if (code === "daily_limit_exceeded") {
        const resetDate = errorData.resetsAtUtc
          ? new Date(errorData.resetsAtUtc).toLocaleString("pl-PL", {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "niebawem";

        return {
          kind: "daily_limit",
          status,
          code,
          message: `Wykorzystałeś dzienny limit generowań. Limit odnowi się: ${resetDate}`,
          canRetry: false,
          action: {
            type: "link",
            href: "/account",
            label: "Zobacz limit w koncie",
          },
        };
      }
      return {
        kind: "unauthorized",
        status,
        code,
        message: errorData.message || "Brak uprawnień do wykonania tej operacji.",
        canRetry: false,
      };

    case 422:
      return {
        kind: "low_quality",
        status,
        code,
        message:
          errorData.message ||
          "Z tego materiału nie da się wygenerować wartościowych fiszek. Spróbuj wkleić dłuższy lub bardziej merytoryczny fragment.",
        canRetry: true,
      };

    case 500:
      return {
        kind: "provider",
        status,
        code,
        message: errorData.message || "Wystąpił błąd podczas generowania. Spróbuj ponownie.",
        canRetry: true,
      };

    case 401:
      return {
        kind: "unauthorized",
        status,
        code,
        message: "Sesja wygasła. Zaloguj się ponownie.",
        canRetry: false,
        action: {
          type: "link",
          href: "/auth/login?returnTo=/generate",
          label: "Przejdź do logowania",
        },
      };

    default:
      return {
        kind: "unknown",
        status,
        code,
        message: errorData.message || "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.",
        canRetry: true,
      };
  }
}

/**
 * Mapuje błąd sieci na ApiErrorVm
 */
export function mapNetworkError(error: Error): ApiErrorVm {
  return {
    kind: "network",
    message: "Problem z połączeniem. Sprawdź połączenie internetowe i spróbuj ponownie.",
    canRetry: true,
  };
}

/**
 * Wywołuje POST /api/generations
 */
export async function generateFlashcards(text: string): Promise<GenerationStartResponse> {
  const command: GenerationCreateCommand = { text: text.trim() };

  const response = await fetch("/api/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    throw await mapApiError(response);
  }

  return await response.json();
}

/**
 * Wywołuje POST /api/flashcards
 */
export async function saveFlashcards(command: CreateFlashcardsCommand): Promise<CreateFlashcardsResponse> {
  const response = await fetch("/api/flashcards", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    // Obsługa 401 - redirect do logowania
    if (response.status === 401) {
      window.location.href = "/auth/login?returnTo=/generate";
      throw new Error("Unauthorized");
    }

    throw await mapApiError(response);
  }

  return await response.json();
}
