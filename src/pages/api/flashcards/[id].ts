import type { APIRoute } from "astro";

import { z } from "zod";

import { FlashcardNotFoundError, FlashcardService } from "../../../lib/services/flashcardService.ts";
import { logger } from "../../../lib/logger.ts";
import { DEFAULT_USER_ID, type SupabaseClient } from "../../../db/supabase.client.ts";
import type { ErrorResponse, UpdateFlashcardCommand, UpdateFlashcardResponse } from "../../../types.ts";
import { updateFlashcardPayloadSchema } from "../../../lib/validation/flashcards.ts";

export const prerender = false;

const pathParamsSchema = z.object({
  id: z.string().uuid(),
});

const jsonResponse = (body: ErrorResponse | UpdateFlashcardResponse, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

export const PUT: APIRoute = async ({ request, params, locals }) => {
  const supabase = (locals as { supabase?: SupabaseClient }).supabase;
  if (!supabase) {
    logger.error({ message: "Missing supabase client in locals while updating flashcard" });
    return jsonResponse({ code: "server_error", message: "internal server error" }, 500);
  }

  const parsedParams = pathParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    logger.warn({ message: "Invalid path params for flashcard update", errors: parsedParams.error.errors });
    return jsonResponse({ code: "invalid_params", message: "Flashcard id must be a valid UUID" }, 400);
  }

  let parsedBody;
  try {
    parsedBody = updateFlashcardPayloadSchema.parse(await request.json());
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "unknown";
    logger.warn({
      message: "Invalid flashcard update payload",
      error: errorMessage,
    });
    const response: ErrorResponse = { code: "invalid_payload", message: "Request body is invalid" };
    return jsonResponse(response, 400);
  }

  const command: UpdateFlashcardCommand = {};
  if (parsedBody.front !== undefined) {
    command.front = parsedBody.front;
  }
  if (parsedBody.back !== undefined) {
    command.back = parsedBody.back;
  }

  const userId = DEFAULT_USER_ID;
  const service = new FlashcardService(supabase);

  try {
    const result = await service.updateFlashcard(userId, parsedParams.data.id, command);
    return jsonResponse(result, 200);
  } catch (error) {
    if (error instanceof FlashcardNotFoundError) {
      return jsonResponse({ code: "not_found", message: error.message }, 404);
    }

    logger.error({
      message: "Failed to update flashcard",
      error: error instanceof Error ? error.message : "unknown",
      flashcardId: parsedParams.data.id,
      userId,
    });

    return jsonResponse({ code: "server_error", message: "Failed to update flashcard" }, 500);
  }
};
