import type { APIRoute } from "astro";

import { FlashcardNotFoundError, FlashcardService } from "../../../lib/services/flashcardService.ts";
import { logger } from "../../../lib/logger.ts";
import { DEFAULT_USER_ID, type SupabaseClient } from "../../../db/supabase.client.ts";
import type {
  ErrorResponse,
  FlashcardGetResponse,
  UpdateFlashcardCommand,
  UpdateFlashcardResponse,
} from "../../../types.ts";
import { updateFlashcardPayloadSchema, validateFlashcardIdParam } from "../../../lib/validation/flashcards.ts";

export const prerender = false;

const jsonResponse = (body: ErrorResponse | UpdateFlashcardResponse | FlashcardGetResponse, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

export const GET: APIRoute = async ({ params, locals }) => {
  const supabase = (locals as { supabase?: SupabaseClient }).supabase;
  if (!supabase) {
    logger.error({ message: "Missing supabase client in locals while fetching flashcard" });
    return jsonResponse({ code: "server_error", message: "internal server error" }, 500);
  }

  const parsedParams = validateFlashcardIdParam({ id: params.id });
  if (!parsedParams.success) {
    return jsonResponse(
      { code: "invalid_request", message: parsedParams.error.errors[0]?.message ?? "Invalid request." },
      400
    );
  }

  const userId = DEFAULT_USER_ID;
  const service = new FlashcardService(supabase);

  try {
    const flashcard = await service.getFlashcardById(userId, parsedParams.data.id);
    if (!flashcard) {
      return jsonResponse({ code: "not_found", message: "Flashcard not found." }, 404);
    }
    return jsonResponse(flashcard, 200);
  } catch (error) {
    logger.error({
      event: "flashcards.detail.failed",
      error: error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" },
      userId,
      id: parsedParams.data.id,
    });
    return jsonResponse({ code: "server_error", message: "Failed to fetch flashcard." }, 500);
  }
};

export const PUT: APIRoute = async ({ request, params, locals }) => {
  const supabase = (locals as { supabase?: SupabaseClient }).supabase;
  if (!supabase) {
    logger.error({ message: "Missing supabase client in locals while updating flashcard" });
    return jsonResponse({ code: "server_error", message: "internal server error" }, 500);
  }

  const parsedParams = validateFlashcardIdParam({ id: params.id });
  if (!parsedParams.success) {
    logger.warn({ message: "Invalid path params for flashcard update", errors: parsedParams.error.errors });
    return jsonResponse({ code: "invalid_request", message: "Flashcard id must be a valid UUID" }, 400);
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

export const DELETE: APIRoute = async ({ params, locals }) => {
  const supabase = (locals as { supabase?: SupabaseClient }).supabase;
  if (!supabase) {
    logger.error({ message: "Missing supabase client in locals while deleting flashcard" });
    return jsonResponse({ code: "unauthorized", message: "Authentication required." }, 401);
  }

  const parsedParams = validateFlashcardIdParam({ id: params.id });
  if (!parsedParams.success) {
    logger.warn({ message: "Invalid path params for flashcard delete", errors: parsedParams.error.errors });
    return jsonResponse({ code: "invalid_request", message: "Flashcard id must be a valid UUID" }, 400);
  }

  const userId = DEFAULT_USER_ID;
  const service = new FlashcardService(supabase);

  try {
    await service.deleteFlashcard(userId, parsedParams.data.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof FlashcardNotFoundError) {
      return jsonResponse({ code: "not_found", message: error.message }, 404);
    }

    logger.error({
      event: "flashcards.delete.failed",
      error: error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" },
      userId,
      flashcardId: parsedParams.data.id,
    });
    return jsonResponse({ code: "server_error", message: "Failed to delete flashcard." }, 500);
  }
};
