import type { APIRoute } from "astro";
import type { SupabaseClient } from "../../../db/supabase.client.ts";
import { DEFAULT_USER_ID, supabaseClient } from "../../../db/supabase.client.ts";
import { GenerationService } from "../../../lib/services/generationService.ts";
import { validateGenerationIdParam } from "../../../lib/validation/generations.ts";
import { logger } from "../../../lib/logger.ts";

export const prerender = false;

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const GET: APIRoute = async ({ params, locals }) => {
  const supabase = (locals as { supabase?: SupabaseClient }).supabase ?? supabaseClient;

  const parsed = validateGenerationIdParam({ id: params.id });
  if (!parsed.success) {
    return jsonResponse(400, {
      code: "invalid_request",
      message: parsed.error.errors[0]?.message ?? "Invalid request.",
    });
  }

  const service = new GenerationService(supabase);
  const userId = DEFAULT_USER_ID;

  try {
    const generation = await service.getGenerationById(userId, parsed.data.id);
    if (!generation) {
      return jsonResponse(404, { code: "not_found", message: "Generation not found." });
    }
    return jsonResponse(200, generation);
  } catch (error) {
    logger.error({
      event: "generations.detail.failed",
      error: error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" },
      userId,
      id: parsed.data.id,
    });
    return jsonResponse(500, { code: "server_error", message: "Failed to fetch generation." });
  }
};
