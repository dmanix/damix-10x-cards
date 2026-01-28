import { describe, expect, it, vi } from "vitest";

import { GenerationService } from "@/lib/services/generationService";

describe("GenerationService.listGenerations", () => {
  it("filters generations by the authenticated user", async () => {
    const rows = [
      {
        id: "gen-1",
        status: "succeeded",
        created_at: "2026-01-28T10:00:00.000Z",
        finished_at: "2026-01-28T10:01:00.000Z",
        generated_count: 8,
        accepted_original_count: 5,
        accepted_edited_count: 2,
        error_code: null,
        error_message: null,
      },
    ];

    const queryBuilder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
    };

    queryBuilder.select.mockImplementation(() => queryBuilder);
    queryBuilder.eq.mockImplementation(() => queryBuilder);
    queryBuilder.order.mockImplementation(() => queryBuilder);
    queryBuilder.range.mockResolvedValue({ data: rows, error: null, count: rows.length });

    const supabase = {
      from: vi.fn(() => queryBuilder),
    };

    const service = new GenerationService(supabase as unknown as Parameters<typeof GenerationService>[0]);

    const response = await service.listGenerations("user-123", {
      page: 1,
      pageSize: 10,
      sort: "createdAt",
      order: "desc",
      status: undefined,
    });

    expect(queryBuilder.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(response).toMatchInlineSnapshot(`
      {
        "items": [
          {
            "acceptedEditedCount": 2,
            "acceptedOriginalCount": 5,
            "createdAt": "2026-01-28T10:00:00.000Z",
            "error": {
              "code": null,
              "message": null,
            },
            "finishedAt": "2026-01-28T10:01:00.000Z",
            "generatedCount": 8,
            "id": "gen-1",
            "status": "succeeded",
          },
        ],
        "page": 1,
        "pageSize": 10,
        "total": 1,
      }
    `);
  });
});
