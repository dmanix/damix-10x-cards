import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchWithTimeout, mapFlashcardsApiError } from "@/components/flashcards/api";

describe("mapFlashcardsApiError", () => {
  it("maps known HTTP status codes to business-friendly errors", () => {
    expect(mapFlashcardsApiError({ message: "Custom 401" }, 401)).toMatchInlineSnapshot(`
      {
        "canRetry": false,
        "code": undefined,
        "kind": "unauthorized",
        "message": "Sesja wygasła. Zaloguj się ponownie.",
        "status": 401,
      }
    `);

    expect(mapFlashcardsApiError({ message: "Not found" }, 404)).toMatchInlineSnapshot(`
      {
        "canRetry": false,
        "code": undefined,
        "kind": "not_found",
        "message": "Not found",
        "status": 404,
      }
    `);

    expect(mapFlashcardsApiError({ message: "Invalid" }, 400)).toMatchInlineSnapshot(`
      {
        "canRetry": true,
        "code": undefined,
        "kind": "validation",
        "message": "Invalid",
        "status": 400,
      }
    `);

    expect(mapFlashcardsApiError({ message: "Server down" }, 503)).toMatchInlineSnapshot(`
      {
        "canRetry": true,
        "code": undefined,
        "kind": "server",
        "message": "Server down",
        "status": 503,
      }
    `);
  });

  it("maps network and timeout errors and uses fallback messages", () => {
    const abortError = new DOMException("Aborted", "AbortError");

    expect(mapFlashcardsApiError(abortError)).toMatchInlineSnapshot(`
      {
        "canRetry": true,
        "kind": "timeout",
        "message": "Problem z połączeniem. Sprawdź internet i spróbuj ponownie.",
      }
    `);

    expect(mapFlashcardsApiError(new TypeError("Network"))).toMatchInlineSnapshot(`
      {
        "canRetry": true,
        "kind": "network",
        "message": "Problem z połączeniem. Sprawdź internet i spróbuj ponownie.",
      }
    `);

    expect(mapFlashcardsApiError({})).toMatchInlineSnapshot(`
      {
        "canRetry": true,
        "code": undefined,
        "kind": "unknown",
        "message": "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.",
        "status": undefined,
      }
    `);
  });
});

describe("fetchWithTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("resolves when fetch completes before timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise((resolve) => setTimeout(() => resolve({ ok: true } as Response), 10)))
    );

    const promise = fetchWithTimeout("/api/test", { method: "GET" }, 1000);

    vi.advanceTimersByTime(10);
    await expect(promise).resolves.toMatchObject({ ok: true });
  });

  it("aborts when timeout expires", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
          })
      )
    );

    const promise = fetchWithTimeout("/api/test", { method: "GET" }, 50);

    vi.advanceTimersByTime(50);
    await expect(promise).rejects.toThrowError(/AbortError/);
  });

  it("honors an already-aborted external signal", async () => {
    const controller = new AbortController();
    controller.abort();

    const fetchSpy = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const aborted = Boolean(init?.signal?.aborted);
      return Promise.resolve({ ok: !aborted } as Response);
    });

    vi.stubGlobal("fetch", fetchSpy);

    const response = await fetchWithTimeout("/api/test", { method: "GET" }, 1000, controller.signal);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(response.ok).toBe(false);
  });
});