import { describe, expect, it, vi, afterEach } from "vitest";

import type { FlashcardDto } from "@/types";
import {
  computeTotalPages,
  mapFlashcardDtoToCardVm,
  parseFlashcardsQueryFromUrl,
  toUrlSearchParams,
} from "@/components/flashcards/types";

describe("parseFlashcardsQueryFromUrl", () => {
  it("uses defaults and clamps invalid numeric params", () => {
    const result = parseFlashcardsQueryFromUrl("?page=0&pageSize=0&sort=bogus&order=up&source=wrong");

    expect(result).toMatchInlineSnapshot(`
      {
        "order": "desc",
        "page": 1,
        "pageSize": 1,
        "search": undefined,
        "sort": "updatedAt",
        "source": undefined,
      }
    `);
  });

  it("accepts valid params and trims search to 200 chars", () => {
    const longSearch = "a".repeat(205);
    const result = parseFlashcardsQueryFromUrl(
      `?page=3&pageSize=150&sort=createdAt&order=asc&source=ai-edited&search=${longSearch}`
    );

    expect(result).toMatchInlineSnapshot(`
      {
        "order": "asc",
        "page": 3,
        "pageSize": 100,
        "search": "${"a".repeat(200)}",
        "sort": "createdAt",
        "source": "ai-edited",
      }
    `);
  });
});

describe("toUrlSearchParams", () => {
  it("serializes query including trimmed search and source", () => {
    const query = {
      page: 2,
      pageSize: 50,
      sort: "createdAt" as const,
      order: "asc" as const,
      source: "manual" as const,
      search: "  fiszka  ",
    };

    expect(toUrlSearchParams(query)).toMatchInlineSnapshot(
      `"page=2&pageSize=50&sort=createdAt&order=asc&source=manual&search=fiszka"`
    );
  });

  it("omits optional params when not provided", () => {
    const query = {
      page: 1,
      pageSize: 20,
      sort: "updatedAt" as const,
      order: "desc" as const,
      source: undefined,
      search: undefined,
    };

    expect(toUrlSearchParams(query)).toMatchInlineSnapshot(`"page=1&pageSize=20&sort=updatedAt&order=desc"`);
  });
});

describe("computeTotalPages", () => {
  it("returns at least 1 page when total is zero or less", () => {
    expect(computeTotalPages(0, 20)).toBe(1);
    expect(computeTotalPages(-5, 20)).toBe(1);
  });

  it("calculates total pages using ceiling", () => {
    expect(computeTotalPages(1, 10)).toBe(1);
    expect(computeTotalPages(10, 10)).toBe(1);
    expect(computeTotalPages(11, 10)).toBe(2);
  });
});

describe("mapFlashcardDtoToCardVm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps dto fields and formats date labels", () => {
    const toLocaleSpy = vi.spyOn(Date.prototype, "toLocaleString").mockImplementation(function (
      locales?: string | string[]
    ) {
      return `formatted-${String(locales)}-${this.toISOString()}`;
    });

    const dto: FlashcardDto = {
      id: "card-1",
      front: "Front",
      back: "Back",
      source: "manual",
      generationId: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-02T10:30:00.000Z",
    };

    const result = mapFlashcardDtoToCardVm(dto);

    expect(toLocaleSpy).toHaveBeenCalledTimes(2);
    expect(toLocaleSpy).toHaveBeenNthCalledWith(1, "pl-PL");
    expect(toLocaleSpy).toHaveBeenNthCalledWith(2, "pl-PL");
    expect(result).toMatchInlineSnapshot(`
      {
        "back": "Back",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "createdAtLabel": "formatted-pl-PL-2024-01-01T00:00:00.000Z",
        "front": "Front",
        "id": "card-1",
        "source": "manual",
        "updatedAt": "2024-01-02T10:30:00.000Z",
        "updatedAtLabel": "formatted-pl-PL-2024-01-02T10:30:00.000Z",
      }
    `);
  });
});
