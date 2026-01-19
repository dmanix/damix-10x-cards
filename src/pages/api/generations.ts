import type { APIRoute } from "astro";

import { DEFAULT_USER_ID, supabaseClient } from "../../db/supabase.client.ts";
import { GenerationService, InputLengthError, DailyLimitExceededError } from "../../lib/services/generationService.ts";
import { validateGenerationCreateCommand } from "../../lib/validation/generations.ts";

export const prerender = false;

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const POST: APIRoute = async ({ request, locals }) => {
  const supabase = (locals as { supabase?: typeof supabaseClient }).supabase ?? supabaseClient;
  const service = new GenerationService(supabase);
  const userId = DEFAULT_USER_ID;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { code: "invalid_request", message: "Invalid JSON body." });
  }

  const parsed = validateGenerationCreateCommand(payload);
  if (!parsed.success) {
    return jsonResponse(400, {
      code: "invalid_request",
      message: parsed.error.errors[0]?.message ?? "Invalid request.",
    });
  }

  const normalized = service.normalizeInput(parsed.data.text);
  try {
    service.ensureInputLength(normalized);
  } catch (error) {
    if (error instanceof InputLengthError) {
      return jsonResponse(400, { code: "invalid_request", message: error.message });
    }
    throw error;
  }

  let usage;
  try {
    usage = await service.assertWithinDailyLimit(userId);
  } catch (error) {
    if (error instanceof DailyLimitExceededError) {
      return jsonResponse(403, {
        code: "daily_limit_exceeded",
        message: error.message,
        remaining: error.remaining,
        limit: error.limit,
        resetsAtUtc: error.resetsAtUtc,
      });
    }
    throw error;
  }

  const pending = await service.insertPendingGeneration({
    user_id: userId,
    input_hash: normalized.hash,
    input_length: normalized.length,
  });

  try {
    const providerResult = await service.runMockGenerationProvider(normalized);

    if (providerResult.type === "low_quality") {
      await service.markGenerationFailed(pending.id, "low_quality_input", providerResult.message);
      return jsonResponse(422, {
        code: "low_quality_input",
        message: providerResult.message,
        remaining: usage.remaining,
      });
    }

    await service.markGenerationSucceeded(pending.id, providerResult.proposals.length);

    return jsonResponse(201, {
      generation: {
        id: pending.id,
        status: "succeeded",
        createdAt: pending.created_at,
      },
      proposals: providerResult.proposals,
      dailyLimit: service.buildDailyLimitDto({
        ...usage,
        remaining: Math.max(usage.remaining - 1, 0),
      }),
    });
  } catch (error) {
    await service.markGenerationFailed(
      pending.id,
      "provider_error",
      error instanceof Error ? error.message : "Provider error"
    );
    return jsonResponse(500, { code: "provider_error", message: "Failed to generate proposals." });
  }
};
