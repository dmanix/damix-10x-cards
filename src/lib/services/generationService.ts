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

type GenerationRow = Tables<"generations">;
type GenerationInsert = TablesInsert<"generations">;

export interface InputSnapshot {
  text: string;
  length: number;
  hash: string;
}

export interface DailyUsage {
  limit: number;
  used: number;
  remaining: number;
  resetsAtUtc: string;
}

export type ProviderResult = { type: "success"; proposals: ProposalDto[] } | { type: "low_quality"; message: string };

export class InputLengthError extends Error {
  constructor(
    public readonly length: number,
    public readonly min: number,
    public readonly max: number
  ) {
    super(`Input length must be between ${min} and ${max} characters.`);
    this.name = "InputLengthError";
  }
}

export class DailyLimitExceededError extends Error {
  constructor(
    public readonly limit: number,
    public readonly remaining: number,
    public readonly resetsAtUtc: string
  ) {
    super("Daily generation limit exceeded.");
    this.name = "DailyLimitExceededError";
  }
}

export class LowQualityInputError extends Error {
  constructor(public readonly reason: string) {
    super("Low quality input detected by provider.");
    this.name = "LowQualityInputError";
  }
}

export const MIN_INPUT_LENGTH = 1000;
export const MAX_INPUT_LENGTH = 20000;
const DAILY_LIMIT_KEY = "daily_generation_limit";

const hexFromBuffer = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

const getSubtleCrypto = async (): Promise<SubtleCrypto> => {
  if (globalThis.crypto?.subtle) return globalThis.crypto.subtle;
  const nodeCrypto = await import("node:crypto");
  if (nodeCrypto.webcrypto?.subtle) return nodeCrypto.webcrypto.subtle;
  throw new Error("Web Crypto API is not available.");
};

const hashInput = async (value: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const subtle = await getSubtleCrypto();
  const digest = await subtle.digest("SHA-256", data);
  return hexFromBuffer(digest);
};

export class GenerationService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly now: () => Date = () => new Date(),
    private readonly openRouterService?: OpenRouterService
  ) {}

  async buildInputSnapshot(raw: string): Promise<InputSnapshot> {
    return { text: raw, length: raw.length, hash: await hashInput(raw) };
  }

  ensureInputLength(input: InputSnapshot): void {
    if (input.length < MIN_INPUT_LENGTH || input.length > MAX_INPUT_LENGTH) {
      throw new InputLengthError(input.length, MIN_INPUT_LENGTH, MAX_INPUT_LENGTH);
    }
  }

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

  async assertWithinDailyLimit(userId: string, now: Date = this.now()): Promise<DailyUsage> {
    const usage = await this.getDailyUsage(userId, now);
    if (usage.remaining <= 0) {
      throw new DailyLimitExceededError(usage.limit, usage.remaining, usage.resetsAtUtc);
    }

    return usage;
  }

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
   * This is the production implementation.
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
   * Returns hardcoded flashcard proposals.
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

    return { type: "success", proposals };
  }

  buildDailyLimitDto(usage: DailyUsage): DailyLimitDto {
    return {
      limit: usage.limit,
      remaining: usage.remaining,
      resetsAtUtc: usage.resetsAtUtc,
    };
  }

  private getResetsAtUtc(now: Date = this.now()): string {
    return nextUtcMidnight(now);
  }
}
