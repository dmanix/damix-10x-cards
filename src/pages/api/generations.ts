import type { APIRoute } from "astro";

import { DEFAULT_USER_ID, supabaseClient } from "../../db/supabase.client.ts";
import { GenerationService, InputLengthError, DailyLimitExceededError } from "../../lib/services/generationService.ts";
import { validateGenerationCreateCommand } from "../../lib/validation/generations.ts";
import { OpenRouterService } from "../../lib/openrouter/openRouterService.ts";

export const prerender = false;

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const POST: APIRoute = async ({ request, locals }) => {
  const supabase = (locals as { supabase?: typeof supabaseClient }).supabase ?? supabaseClient;

  // Initialize OpenRouter service if API key is available
  let openRouterService: OpenRouterService | undefined;
  const apiKey = import.meta.env.OPENROUTER_API_KEY;
  const defaultModel = import.meta.env.OPENROUTER_DEFAULT_MODEL ?? "openai/gpt-4o-mini";

  if (apiKey) {
    try {
      openRouterService = new OpenRouterService({
        apiKey,
        defaultModel,
        timeoutMs: 30000,
        appName: import.meta.env.PUBLIC_APP_NAME,
        appUrl: import.meta.env.PUBLIC_APP_URL,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to initialize OpenRouterService:", error);
      return jsonResponse(500, {
        code: "service_unavailable",
        message: "AI service is not properly configured.",
      });
    }
  }

  const service = new GenerationService(supabase, undefined, openRouterService);
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

  const inputSnapshot = service.buildInputSnapshot(parsed.data.text);
  try {
    service.ensureInputLength(inputSnapshot);
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
    input_hash: inputSnapshot.hash,
    input_length: inputSnapshot.length,
  });

  try {
    // Use real provider if OpenRouter is configured, otherwise fallback to mock
    const providerResult = openRouterService
      ? await service.runGenerationProvider(inputSnapshot)
      : await service.runMockGenerationProvider(inputSnapshot);

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
