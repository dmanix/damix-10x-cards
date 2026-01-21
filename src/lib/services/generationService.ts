import { createHash } from "crypto";

import type { SupabaseClient } from "../../db/supabase.client.ts";
import type { Tables, TablesInsert } from "../../db/database.types.ts";
import { nextUtcMidnight, utcStartOfDay } from "../dates.ts";
import type { DailyLimitDto, ProposalDto } from "../../types.ts";

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

const hashInput = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

export class GenerationService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly now: () => Date = () => new Date()
  ) {}

  buildInputSnapshot(raw: string): InputSnapshot {
    return { text: raw, length: raw.length, hash: hashInput(raw) };
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
