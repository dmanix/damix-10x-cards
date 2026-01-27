import { http, HttpResponse } from "msw";

const BASE_URL = process.env.PUBLIC_SUPABASE_URL || "https://test.supabase.co";

/**
 * MSW request handlers for mocking API calls
 * Add your API endpoints here
 */
export const handlers = [
  // Example: Mock Supabase REST API
  http.get(`${BASE_URL}/rest/v1/flashcards`, () => {
    return HttpResponse.json([
      {
        id: "1",
        front_text: "Test Question",
        back_text: "Test Answer",
        user_id: "test-user-id",
        created_at: new Date().toISOString(),
      },
    ]);
  }),

  // Example: Mock generation API
  http.post("/api/generations", async () => {
    return HttpResponse.json({
      id: "1",
      status: "completed",
      flashcards: [],
    });
  }),

  // Example: Mock quota API
  http.get("/api/generations/quota", () => {
    return HttpResponse.json({
      used: 5,
      limit: 50,
      remaining: 45,
    });
  }),
];
