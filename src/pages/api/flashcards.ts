import type { APIRoute } from "astro";

import type { SupabaseClient } from "../../db/supabase.client.ts";
import { DEFAULT_USER_ID } from "../../db/supabase.client.ts";
import type { CreateFlashcardsResponse } from "../../types.ts";
import { FlashcardService, GenerationOwnershipError } from "../../lib/services/flashcardService.ts";
import { validateCreateFlashcardsCommand, validateFlashcardListQuery } from "../../lib/validation/flashcards.ts";
import { logger } from "../../lib/logger.ts";

export const prerender = false;

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const GET: APIRoute = async ({ request, locals }) => {
  const supabase = (locals as { supabase?: SupabaseClient }).supabase;
  if (!supabase) {
    return jsonResponse(500, { code: "server_error", message: "Supabase client unavailable." });
  }

  const userId = DEFAULT_USER_ID;

  const searchParams = new URL(request.url).searchParams;
  const pickParam = (name: string): string | undefined => {
    const value = searchParams.get(name);
    return value && value.length > 0 ? value : undefined;
  };

  const parsed = validateFlashcardListQuery({
    page: pickParam("page"),
    pageSize: pickParam("pageSize"),
    sort: pickParam("sort"),
    order: pickParam("order"),
    source: pickParam("source"),
    search: pickParam("search"),
    since: pickParam("since"),
  });

  if (!parsed.success) {
    return jsonResponse(400, {
      code: "invalid_request",
      message: parsed.error.errors[0]?.message ?? "Invalid request.",
    });
  }

  const service = new FlashcardService(supabase);

  try {
    const response = await service.listFlashcards(userId, parsed.data);
    return jsonResponse(200, response);
  } catch (error) {
    logger.error({
      event: "flashcards.list.failed",
      error: error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" },
      userId,
      query: parsed.data,
    });
    return jsonResponse(500, { code: "server_error", message: "Failed to fetch flashcards." });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const supabase = (locals as { supabase?: SupabaseClient }).supabase;
  if (!supabase) {
    return jsonResponse(500, { code: "server_error", message: "Supabase client unavailable." });
  }
  const userId = DEFAULT_USER_ID;
  const service = new FlashcardService(supabase);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { code: "invalid_request", message: "Invalid JSON body." });
  }

  const parsed = validateCreateFlashcardsCommand(payload);
  if (!parsed.success) {
    return jsonResponse(400, {
      code: "invalid_request",
      message: parsed.error.errors[0]?.message ?? "Invalid request.",
    });
  }

  const normalizedFlashcards = parsed.data.flashcards.map((flashcard) => ({
    front: flashcard.front.trim(),
    back: flashcard.back.trim(),
    source: flashcard.source,
    generationId: flashcard.source === "manual" ? null : flashcard.generationId,
  }));

  const hasEmptyValues = normalizedFlashcards.some(
    (flashcard) => flashcard.front.length === 0 || flashcard.back.length === 0
  );
  if (hasEmptyValues) {
    return jsonResponse(400, { code: "invalid_request", message: "front and back cannot be empty." });
  }

  const generationIds = normalizedFlashcards
    .map((flashcard) => flashcard.generationId)
    .filter((generationId): generationId is string => typeof generationId === "string");

  try {
    await service.validateGenerationOwnership(userId, generationIds);
  } catch (error) {
    if (error instanceof GenerationOwnershipError) {
      return jsonResponse(403, {
        code: "generation_ownership_mismatch",
        message: "One or more generations do not belong to the authenticated user.",
      });
    }

    logger.error({
      event: "flashcards.validateGenerationOwnership.failed",
      error: error instanceof Error ? error.message : "Unknown error",
      generationCount: generationIds.length,
    });
    return jsonResponse(500, { code: "server_error", message: "Failed to validate generations." });
  }

  try {
    const created = await service.createFlashcards(userId, normalizedFlashcards);
    const response: CreateFlashcardsResponse = { created };
    return jsonResponse(201, response);
  } catch (error) {
    if (error instanceof GenerationOwnershipError) {
      return jsonResponse(403, {
        code: "generation_ownership_mismatch",
        message: "One or more generations do not belong to the authenticated user.",
      });
    }

    logger.error({
      event: "flashcards.create.failed",
      error: error instanceof Error ? error.message : "Unknown error",
      generationCount: generationIds.length,
      createdCount: normalizedFlashcards.length,
    });
    return jsonResponse(500, { code: "server_error", message: "Failed to create flashcards." });
  }
};
