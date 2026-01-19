import { createHash } from "crypto";

import type { SupabaseClient } from "../../db/supabase.client.ts";
import type { Tables, TablesInsert } from "../../db/database.types.ts";
import { nextUtcMidnight, utcStartOfDay } from "../dates.ts";
import type { DailyLimitDto, ProposalDto } from "../../types.ts";

type GenerationRow = Tables<"generations">;
type GenerationInsert = TablesInsert<"generations">;

export interface NormalizedInput {
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
    super(`Input length must be between ${min} and ${max} characters after normalization.`);
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

const normalizeWhitespace = (value: string): string => value.trim().replace(/\s+/g, " ");

const hashInput = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

export class GenerationService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly now: () => Date = () => new Date()
  ) {}

  normalizeInput(raw: string): NormalizedInput {
    const text = normalizeWhitespace(raw);
    return { text, length: text.length, hash: hashInput(text) };
  }

  ensureInputLength(input: NormalizedInput): void {
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
    const input_hash_hex = createHash("sha256").update(params.input_hash, "utf8").digest("hex");
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

  async runMockGenerationProvider(input: NormalizedInput): Promise<ProviderResult> {
    if (input.length < MIN_INPUT_LENGTH + 200) {
      return {
        type: "low_quality",
        message: "Input is too short to extract high-quality flashcards.",
      };
    }

    const proposals: ProposalDto[] = [
      {
        front: "What is the main idea of the provided text?",
        back: "The text discusses a key concept and its implications in detail.",
      },
      {
        front: "List two important details mentioned in the text.",
        back: "It highlights a significant challenge and proposes a practical solution.",
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
