import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../../db/supabase.client.ts";
import { GenerationService } from "../../../lib/services/generationService.ts";
import { logger } from "../../../lib/logger.ts";

export const prerender = false;

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const GET: APIRoute = async ({ locals }) => {
  const supabase = (locals as { supabase?: SupabaseClient }).supabase;
  if (!supabase) {
    return jsonResponse(500, { code: "server_error", message: "Supabase client unavailable." });
  }

  const service = new GenerationService(supabase);
  const userId = (locals as { user?: { id: string } | null }).user?.id;
  if (!userId) {
    return jsonResponse(401, { code: "unauthorized", message: "Authentication required." });
  }

  try {
    const usage = await service.getDailyUsage(userId);
    return jsonResponse(200, service.buildDailyLimitDto(usage));
  } catch (error) {
    logger.error({
      event: "generations.quota.failed",
      error: error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" },
      userId,
    });
    return jsonResponse(500, { code: "server_error", message: "Failed to fetch generation quota." });
  }
};
