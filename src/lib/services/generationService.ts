/**
 * @fileoverview Generation service for AI-powered flashcard creation.
 *
 * This module provides the core business logic for flashcard generation,
 * including input validation, daily usage limits, AI provider integration,
 * and database operations for tracking generation history.
 *
 * @module generationService
 *
 * @dependencies
 * - Supabase client for database operations
 * - OpenRouter service for AI flashcard generation
 * - Date utilities for UTC time handling
 * - Validation schemas for OpenRouter requests/responses
 * - Logger for structured event logging
 */

import type { SupabaseClient } from "../../db/supabase.client.ts";
import type { Tables, TablesInsert } from "../../db/database.types.ts";
import { nextUtcMidnight, utcStartOfDay } from "../dates.ts";
import type { DailyLimitDto, GenerationDto, GenerationListQuery, ProposalDto } from "../../types.ts";
import { OpenRouterService } from "../openrouter/openRouterService.ts";
import {
  OpenRouterConfigError,
  OpenRouterTimeoutError,
  OpenRouterUpstreamError,
  OpenRouterInvalidOutputError,
} from "../openrouter/openrouter.types.ts";
import {
  buildFlashcardsSystemMessage,
  buildFlashcardsUserMessage,
  flashcardsResponseFormat,
  validateFlashcardsGenerationDTO,
} from "../validation/openrouter.ts";
import { logger } from "../logger.ts";

/**
 * Type alias for the generations table row from database schema.
 * @typedef {Tables<"generations">} GenerationRow
 */
type GenerationRow = Tables<"generations">;

/**
 * Type alias for the generations table insert type from database schema.
 * @typedef {TablesInsert<"generations">} GenerationInsert
 */
type GenerationInsert = TablesInsert<"generations">;

/**
 * Represents a snapshot of user input text with computed metadata.
 *
 * This interface captures the original text, its length, and a SHA-256 hash
 * for deduplication and integrity verification purposes.
 */
export interface InputSnapshot {
  /** The original input text provided by the user. */
  text: string;
  /** The character length of the input text. */
  length: number;
  /** SHA-256 hash of the input text for deduplication. */
  hash: string;
}

/**
 * Represents the current daily usage statistics for flashcard generation.
 *
 * Tracks the user's daily limit, current usage, and when the limit resets.
 */
export interface DailyUsage {
  /** The maximum number of generations allowed per day. */
  limit: number;
  /** The number of generations already used today. */
  used: number;
  /** The number of generations remaining for today. */
  remaining: number;
  /** ISO 8601 timestamp when the daily limit resets (UTC midnight). */
  resetsAtUtc: string;
}

/**
 * Result type for flashcard generation providers.
 *
 * Discriminated union that represents either successful generation
 * with proposals or low-quality input detection.
 */
export type ProviderResult = { type: "success"; proposals: ProposalDto[] } | { type: "low_quality"; message: string };

/**
 * Error thrown when input text length is outside acceptable bounds.
 *
 * This error occurs when the input text is either too short or too long
 * for effective flashcard generation.
 */
export class InputLengthError extends Error {
  /**
   * Creates an InputLengthError with validation details.
   *
   * @param length - The actual length of the input text
   * @param min - The minimum required length
   * @param max - The maximum allowed length
   */
  constructor(
    public readonly length: number,
    public readonly min: number,
    public readonly max: number
  ) {
    super(`Input length must be between ${min} and ${max} characters.`);
    this.name = "InputLengthError";
  }
}

/**
 * Error thrown when the user has exceeded their daily generation limit.
 *
 * This prevents abuse and ensures fair usage of the AI generation service.
 */
export class DailyLimitExceededError extends Error {
  /**
   * Creates a DailyLimitExceededError with usage details.
   *
   * @param limit - The daily limit for the user
   * @param remaining - Remaining generations (will be 0 or negative)
   * @param resetsAtUtc - ISO 8601 timestamp when the limit resets
   */
  constructor(
    public readonly limit: number,
    public readonly remaining: number,
    public readonly resetsAtUtc: string
  ) {
    super("Daily generation limit exceeded.");
    this.name = "DailyLimitExceededError";
  }
}

/**
 * Error thrown when the AI provider detects low-quality input text.
 *
 * This indicates that the input text does not contain enough useful
 * information to generate meaningful flashcards.
 */
export class LowQualityInputError extends Error {
  /**
   * Creates a LowQualityInputError with the reason for rejection.
   *
   * @param reason - Human-readable explanation of why the input was rejected
   */
  constructor(public readonly reason: string) {
    super("Low quality input detected by provider.");
    this.name = "LowQualityInputError";
  }
}

/**
 * Minimum input length required for flashcard generation.
 * Input text must be at least this many characters long.
 */
export const MIN_INPUT_LENGTH = 1000;

/**
 * Maximum input length allowed for flashcard generation.
 * Input text cannot exceed this many characters.
 */
export const MAX_INPUT_LENGTH = 20000;

/** Database key for storing the daily generation limit configuration. */
const DAILY_LIMIT_KEY = "daily_generation_limit";

/**
 * Converts an ArrayBuffer to a hexadecimal string representation.
 *
 * @param buffer - The ArrayBuffer to convert
 * @returns Hexadecimal string representation
 * @private
 */
const hexFromBuffer = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

/**
 * Gets a SubtleCrypto instance for cryptographic operations.
 * Supports both browser and Node.js environments.
 *
 * @returns Promise resolving to SubtleCrypto instance
 * @throws Error if Web Crypto API is not available
 * @private
 */
const getSubtleCrypto = async (): Promise<SubtleCrypto> => {
  if (globalThis.crypto?.subtle) return globalThis.crypto.subtle;
  const nodeCrypto = await import("node:crypto");
  if (nodeCrypto.webcrypto?.subtle) return nodeCrypto.webcrypto.subtle;
  throw new Error("Web Crypto API is not available.");
};

/**
 * Computes SHA-256 hash of the input string.
 *
 * @param value - String to hash
 * @returns Promise resolving to hex-encoded SHA-256 hash
 * @private
 */
const hashInput = async (value: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const subtle = await getSubtleCrypto();
  const digest = await subtle.digest("SHA-256", data);
  return hexFromBuffer(digest);
};

/**
 * Service class for managing AI-powered flashcard generation.
 *
 * This service orchestrates the entire flashcard generation workflow:
 * - Input validation and preprocessing
 * - Daily usage limit enforcement
 * - AI provider integration (OpenRouter)
 * - Database persistence of generation records
 * - Error handling and logging
 *
 * The service supports both production AI generation and mock generation for testing.
 *
 * @example
 * ```typescript
 * const service = new GenerationService(supabaseClient, () => new Date(), openRouterService);
 * const input = await service.buildInputSnapshot("Some long text...");
 * service.ensureInputLength(input);
 * const result = await service.runGenerationProvider(input);
 * ```
 */
export class GenerationService {
  /**
   * Creates a new GenerationService instance.
   *
   * @param supabase - Supabase client for database operations
   * @param now - Function returning current date/time (defaults to Date constructor, injectable for testing)
   * @param openRouterService - Optional OpenRouter service for AI generation (required for production use)
   */
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly now: () => Date = () => new Date(),
    private readonly openRouterService?: OpenRouterService
  ) {}

  /**
   * Creates an InputSnapshot from raw user input text.
   *
   * Computes the text length and SHA-256 hash for deduplication and validation.
   * This method is synchronous in interface but internally uses async crypto operations.
   *
   * @param raw - The raw input text provided by the user
   * @returns Promise resolving to InputSnapshot with computed metadata
   * @throws Error if crypto operations fail (extremely rare)
   */
  async buildInputSnapshot(raw: string): Promise<InputSnapshot> {
    return { text: raw, length: raw.length, hash: await hashInput(raw) };
  }

  /**
   * Validates that input text length is within acceptable bounds.
   *
   * @param input - InputSnapshot to validate
   * @throws {InputLengthError} If length is outside bounds (MIN_INPUT_LENGTH to MAX_INPUT_LENGTH)
   */
  ensureInputLength(input: InputSnapshot): void {
    if (input.length < MIN_INPUT_LENGTH || input.length > MAX_INPUT_LENGTH) {
      throw new InputLengthError(input.length, MIN_INPUT_LENGTH, MAX_INPUT_LENGTH);
    }
  }

  /**
   * Retrieves the current daily generation limit from application configuration.
   *
   * Reads the limit from the app_config table using the DAILY_LIMIT_KEY.
   *
   * @returns Promise resolving to the daily limit number
   * @throws Error if configuration cannot be read or is invalid
   */
  async fetchDailyGenerationLimit(): Promise<number> {
    const { data, error } = await this.supabase.from("app_config").select("value").eq("key", DAILY_LIMIT_KEY).single();

    if (error) {
      throw new Error(`Failed to read app_config.${DAILY_LIMIT_KEY}: ${error.message}`);
    }

    const rawValue = data?.value;
    if (!rawValue || typeof rawValue !== "object") {
      throw new Error(`Invalid app_config value for key "${DAILY_LIMIT_KEY}".`);
    }

    const limit = (rawValue as Record<string, unknown>)[DAILY_LIMIT_KEY];
    if (typeof limit !== "number" || Number.isNaN(limit) || limit < 0) {
      throw new Error("Invalid daily_generation_limit value in app_config.");
    }

    return limit;
  }

  /**
   * Counts successful generations for a user within the current UTC day.
   *
   * @param userId - The user ID to count generations for
   * @param now - Current date/time (defaults to service's now function)
   * @returns Promise resolving to count of successful generations today
   * @throws Error if database query fails
   */
  async countTodaySucceededGenerations(userId: string, now: Date = this.now()): Promise<number> {
    const startIso = utcStartOfDay(now);

    const { count, error } = await this.supabase
      .from("generations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "succeeded")
      .gte("created_at", startIso);

    if (error) {
      throw new Error(`Failed to count daily generations: ${error.message}`);
    }

    return count ?? 0;
  }

  /**
   * Retrieves the current daily usage statistics for a user.
   *
   * Combines the daily limit with today's usage count to calculate remaining quota.
   *
   * @param userId - The user ID to get usage statistics for
   * @param now - Current date/time (defaults to service's now function)
   * @returns Promise resolving to DailyUsage object with limit, used, remaining, and reset time
   */
  async getDailyUsage(userId: string, now: Date = this.now()): Promise<DailyUsage> {
    const [limit, used] = await Promise.all([
      this.fetchDailyGenerationLimit(),
      this.countTodaySucceededGenerations(userId, now),
    ]);

    const remaining = Math.max(limit - used, 0);

    return {
      limit,
      used,
      remaining,
      resetsAtUtc: this.getResetsAtUtc(now),
    };
  }

  /**
   * Asserts that the user is within their daily generation limit.
   *
   * @param userId - The user ID to check
   * @param now - Current date/time (defaults to service's now function)
   * @returns Promise resolving to DailyUsage if within limit
   * @throws {DailyLimitExceededError} If the user has exceeded their daily limit
   */
  async assertWithinDailyLimit(userId: string, now: Date = this.now()): Promise<DailyUsage> {
    const usage = await this.getDailyUsage(userId, now);
    if (usage.remaining <= 0) {
      throw new DailyLimitExceededError(usage.limit, usage.remaining, usage.resetsAtUtc);
    }

    return usage;
  }

  /**
   * Creates a new pending generation record in the database.
   *
   * This method also enforces daily limits and hashes the input for storage.
   * The generation record is created with 'pending' status and will be updated
   * when the generation completes or fails.
   *
   * @param params - Generation parameters (user_id, input_hash, input_length)
   * @returns Promise resolving to the created generation record (id, status, created_at)
   * @throws {DailyLimitExceededError} If the user has exceeded their daily limit
   * @throws Error if database insertion fails
   */
  async insertPendingGeneration(
    params: Pick<GenerationInsert, "user_id" | "input_hash" | "input_length">
  ): Promise<Pick<GenerationRow, "id" | "status" | "created_at">> {
    const input_hash_hex = await hashInput(params.input_hash);
    params.input_hash = `\\x${input_hash_hex}`;
    await this.assertWithinDailyLimit(params.user_id);
    const { data, error } = await this.supabase
      .from("generations")
      .insert({
        status: "pending",
        ...params,
      })
      .select("id, status, created_at")
      .single();

    if (error || !data) {
      throw new Error(`Failed to create generation record: ${error?.message ?? "Unknown error"}`);
    }

    return data;
  }

  /**
   * Returns a paginated list of generations for the authenticated user.
   *
   * Supports filtering by status, sorting by creation or finish time,
   * and pagination with configurable page size.
   *
   * @param userId - The user ID to fetch generations for (ownership check)
   * @param query - Query parameters for filtering, sorting, and pagination
   * @returns Promise resolving to paginated generation list with metadata
   * @throws Error if database query fails
   */
  async listGenerations(
    userId: string,
    query: Required<Pick<GenerationListQuery, "page" | "pageSize" | "sort" | "order">> &
      Pick<GenerationListQuery, "status">
  ): Promise<{ items: GenerationDto[]; total: number; page: number; pageSize: number }> {
    const { page, pageSize, sort, order, status } = query;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let queryBuilder = this.supabase
      .from("generations")
      .select(
        "id, status, created_at, finished_at, generated_count, accepted_original_count, accepted_edited_count, error_code, error_message",
        { count: "exact" }
      )
      .eq("user_id", userId);

    if (status) {
      queryBuilder = queryBuilder.eq("status", status);
    }

    const orderColumn = sort === "finishedAt" ? "finished_at" : "created_at";
    queryBuilder = queryBuilder.order(orderColumn, {
      ascending: order === "asc",
      nullsFirst: sort === "finishedAt" ? false : undefined,
    });

    const { data, error, count } = await queryBuilder.range(from, to);
    if (error) {
      throw new Error(`Failed to fetch generations list for user ${userId}: ${error.message}`);
    }

    const items = (data ?? []).map((row) => ({
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      finishedAt: row.finished_at,
      generatedCount: row.generated_count,
      acceptedOriginalCount: row.accepted_original_count,
      acceptedEditedCount: row.accepted_edited_count,
      error: {
        code: row.error_code,
        message: row.error_message,
      },
    }));

    return {
      items,
      page,
      pageSize,
      total: count ?? 0,
    };
  }

  /**
   * Returns details for a single generation owned by the user.
   *
   * Performs ownership validation to ensure users can only access their own generations.
   *
   * @param userId - The user ID for ownership validation
   * @param id - The generation ID to retrieve
   * @returns Promise resolving to GenerationDto if found and owned by user, null otherwise
   * @throws Error if database query fails
   */
  async getGenerationById(userId: string, id: GenerationRow["id"]): Promise<GenerationDto | null> {
    const { data, error } = await this.supabase
      .from("generations")
      .select(
        "id, status, created_at, finished_at, generated_count, accepted_original_count, accepted_edited_count, error_code, error_message"
      )
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch generation ${id} for user ${userId}: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      status: data.status,
      createdAt: data.created_at,
      finishedAt: data.finished_at,
      generatedCount: data.generated_count,
      acceptedOriginalCount: data.accepted_original_count,
      acceptedEditedCount: data.accepted_edited_count,
      error: {
        code: data.error_code,
        message: data.error_message,
      },
    };
  }

  /**
   * Marks a generation record as failed with error details.
   *
   * Updates the generation status to 'failed', sets error information,
   * and records the finish timestamp.
   *
   * @param id - The generation ID to mark as failed
   * @param errorCode - Error code identifier
   * @param errorMessage - Human-readable error message
   * @throws Error if database update fails
   */
  async markGenerationFailed(
    id: GenerationRow["id"],
    errorCode: GenerationRow["error_code"],
    errorMessage: GenerationRow["error_message"]
  ): Promise<void> {
    const { error } = await this.supabase
      .from("generations")
      .update({
        status: "failed",
        error_code: errorCode,
        error_message: errorMessage,
        finished_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to mark generation as failed: ${error.message}`);
    }
  }

  /**
   * Marks a generation record as successfully completed.
   *
   * Updates the generation status to 'succeeded', records the number of
   * flashcards generated, and sets the finish timestamp.
   *
   * @param id - The generation ID to mark as succeeded
   * @param generatedCount - Number of flashcards that were generated
   * @throws Error if database update fails
   */
  async markGenerationSucceeded(id: GenerationRow["id"], generatedCount: number): Promise<void> {
    const { error } = await this.supabase
      .from("generations")
      .update({
        status: "succeeded",
        generated_count: generatedCount,
        finished_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to mark generation as succeeded: ${error.message}`);
    }
  }

  /**
   * Generates flashcard proposals using OpenRouter AI service.
   *
   * This is the production implementation that calls the OpenRouter API
   * to generate flashcards from the input text. Uses structured output
   * validation and handles various error conditions.
   *
   * @param input - InputSnapshot containing the text to generate flashcards from
   * @returns Promise resolving to ProviderResult with success proposals or low_quality message
   * @throws Error if OpenRouter service is not configured or various API errors occur
   */
  async runGenerationProvider(input: InputSnapshot): Promise<ProviderResult> {
    // Guard clause: require OpenRouterService
    if (!this.openRouterService) {
      throw new Error("OpenRouterService is not configured. Cannot generate proposals.");
    }

    const modelParams = {
      temperature: 0.7,
      top_p: 1,
      max_tokens: 3000,
    };

    try {
      // Build messages for flashcard generation
      const systemMessage = buildFlashcardsSystemMessage();
      const userMessage = buildFlashcardsUserMessage(input.text);

      // Call OpenRouter with structured completion
      const result = await this.openRouterService.createStructuredCompletion({
        messages: [systemMessage, userMessage],
        responseFormat: flashcardsResponseFormat,
        validate: (data: unknown) => {
          const validation = validateFlashcardsGenerationDTO(data);
          if (!validation.success) {
            throw new Error(validation.error.errors[0]?.message ?? "Validation failed");
          }
          return validation.data;
        },
        params: modelParams,
      });

      // Map to ProposalDto format
      const proposals: ProposalDto[] = result.data.flashcards.map((card) => ({
        front: card.front,
        back: card.back,
      }));

      // Guard clause: ensure at least one proposal
      if (proposals.length === 0) {
        logger.info({
          event: "generation.openrouter.low_quality",
          model: this.openRouterService.defaultModel,
          params: modelParams,
          inputLength: input.length,
          generatedCount: proposals.length,
        });
        return {
          type: "low_quality",
          message: "AI model did not generate any flashcards from the provided text.",
        };
      }

      logger.info({
        event: "generation.openrouter.success",
        model: this.openRouterService.defaultModel,
        params: modelParams,
        inputLength: input.length,
        generatedCount: proposals.length,
      });

      return { type: "success", proposals };
    } catch (error) {
      logger.error({
        event: "generation.openrouter.error",
        model: this.openRouterService.defaultModel,
        params: modelParams,
        inputLength: input.length,
        error: error instanceof Error ? { name: error.name, message: error.message } : { name: "UnknownError" },
      });
      // Handle OpenRouter-specific errors
      if (error instanceof OpenRouterConfigError) {
        throw new Error(`OpenRouter configuration error: ${error.message}`);
      }

      if (error instanceof OpenRouterTimeoutError) {
        throw new Error(`OpenRouter timeout: ${error.message}`);
      }

      if (error instanceof OpenRouterUpstreamError) {
        // Check for rate limiting
        if (error.status === 429) {
          throw new Error("OpenRouter rate limit exceeded. Please try again later.");
        }

        // Check for authentication errors
        if (error.status === 401 || error.status === 403) {
          throw new Error(`OpenRouter authentication error: ${error.message}`);
        }

        // Generic upstream error
        throw new Error(`OpenRouter upstream error: ${error.message}`);
      }

      if (error instanceof OpenRouterInvalidOutputError) {
        return {
          type: "low_quality",
          message: "AI model output did not meet quality standards. Please try with different input.",
        };
      }

      // Re-throw unknown errors
      throw error;
    }
  }

  /**
   * Mock generation provider for testing and development.
   *
   * Returns hardcoded flashcard proposals instead of calling AI services.
   * Useful for testing the generation pipeline without API calls or costs.
   * May return low_quality result for inputs below a minimum threshold.
   *
   * @param input - InputSnapshot containing the text (used for length validation)
   * @returns Promise resolving to ProviderResult with mock proposals or low_quality message
   */
  async runMockGenerationProvider(input: InputSnapshot): Promise<ProviderResult> {
    if (input.length < MIN_INPUT_LENGTH + 200) {
      return {
        type: "low_quality",
        message: "Input is too short to extract high-quality flashcards.",
      };
    }

    const proposals: ProposalDto[] = [
      {
        front: "Czym jest inferencja typów w TypeScript?",
        back: "Inferencja typów to automatyczne określanie typów zmiennych przez kompilator TypeScript na podstawie przypisanych wartości. Przykład: const x = 5; // x ma typ number bez jawnego określenia.",
      },
      {
        front: "Czym różni się interface od type alias?",
        back: "Interface służy głównie do opisywania kształtów obiektów i może być rozszerzany przez 'extends'. Type alias jest bardziej elastyczny - może reprezentować prymitywy, unie typów, funkcje i krzyżowe typy.",
      },
      {
        front: "Co oznacza modyfikator 'readonly'?",
        back: "Modyfikator 'readonly' uniemożliwia zmianę wartości właściwości po inicjalizacji obiektu. Przykład: interface User { readonly id: number; name: string; }. user.id = 2; // Błąd!",
      },
      {
        front: "Czym są utility types w TypeScript?",
        back: "Utility types to wbudowane typy pomocnicze jak Partial<T>, Required<T>, Pick<T,K>, Omit<T,K>, Record<K,T>. Umożliwiają transformację istniejących typów. Przykład: Partial<User> czyni wszystkie właściwości opcjonalnymi.",
      },
      {
        front: "Co to jest discriminated union?",
        back: "Discriminated union to wzorzec używający wspólnej dyskryminującej właściwości (literal type) do wąskiego typowania w union types. Przykład: type Shape = {kind: 'circle', r: number} | {kind: 'square', side: number}.",
      },
    ];

    logger.info({
      event: "generation.mock.success",
      model: "mock",
      params: null,
      inputLength: input.length,
      generatedCount: proposals.length,
    });

    return { type: "success", proposals };
  }

  /**
   * Converts DailyUsage to the DTO format for API responses.
   *
   * @param usage - Internal DailyUsage object
   * @returns DailyLimitDto suitable for API responses
   */
  buildDailyLimitDto(usage: DailyUsage): DailyLimitDto {
    return {
      limit: usage.limit,
      remaining: usage.remaining,
      resetsAtUtc: usage.resetsAtUtc,
    };
  }

  /**
   * Calculates the UTC timestamp when the daily limit resets.
   *
   * @param now - Current date/time (defaults to service's now function)
   * @returns ISO 8601 timestamp string for the next UTC midnight
   * @private
   */
  private getResetsAtUtc(now: Date = this.now()): string {
    return nextUtcMidnight(now);
  }
}
