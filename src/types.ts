import { Tables } from "./db/database.types";

// Common primitives
export type TimestampString = string;

// Base rows tied to DB entities
type GenerationRow = Tables<"generations">;
type FlashcardRow = Tables<"flashcards">;
type AppConfigRow = Tables<"app_config">;

// Shared helpers
export interface ErrorResponse {
  code: string;
  message: string;
  details?: unknown;
}

export interface PaginatedResponse<TItem> {
  items: TItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface DailyLimitDto {
  remaining: number;
  limit: number;
  resetsAtUtc: TimestampString;
}

// Generations
export type GenerationStatus = GenerationRow["status"];
export interface GenerationErrorDto {
  code: GenerationRow["error_code"];
  message: GenerationRow["error_message"];
}

export interface GenerationDto {
  id: GenerationRow["id"];
  status: GenerationStatus;
  createdAt: GenerationRow["created_at"];
  finishedAt: GenerationRow["finished_at"];
  generatedCount: GenerationRow["generated_count"];
  acceptedOriginalCount: GenerationRow["accepted_original_count"];
  acceptedEditedCount: GenerationRow["accepted_edited_count"];
  error: GenerationErrorDto;
}

export interface GenerationCreateCommand {
  text: string;
}

export type ProposalDto = Pick<FlashcardRow, "front" | "back">;

export interface GenerationStartResponse {
  generation: Pick<GenerationDto, "id" | "status" | "createdAt">;
  proposals: ProposalDto[];
  dailyLimit: DailyLimitDto;
}

export interface GenerationListQuery {
  status?: GenerationStatus;
  page?: number;
  pageSize?: number;
  sort?: "createdAt" | "finishedAt";
  order?: "desc" | "asc";
}

export type GenerationListItemDto = GenerationDto;

export type GenerationListResponse = PaginatedResponse<GenerationListItemDto>;

export type GenerationDetailResponse = GenerationDto;

export type GenerationQuotaResponse = DailyLimitDto;

// Flashcards
export type FlashcardSource = "manual" | "ai" | "ai-edited";

export interface FlashcardDto {
  id: FlashcardRow["id"];
  front: FlashcardRow["front"];
  back: FlashcardRow["back"];
  source: FlashcardSource;
  generationId: FlashcardRow["generation_id"];
  createdAt: FlashcardRow["created_at"];
  updatedAt: FlashcardRow["updated_at"];
}

export interface FlashcardListQuery {
  page?: number;
  pageSize?: number;
  sort?: "createdAt" | "updatedAt";
  order?: "desc" | "asc";
  source?: FlashcardSource;
  search?: string;
  since?: TimestampString;
}

export type FlashcardListResponse = PaginatedResponse<FlashcardDto>;

export type FlashcardGetResponse = FlashcardDto;

interface CreateManualFlashcardCommand {
  front: FlashcardRow["front"];
  back: FlashcardRow["back"];
  source: "manual";
  generationId?: null;
}

interface CreateAiFlashcardCommand {
  front: FlashcardRow["front"];
  back: FlashcardRow["back"];
  source: Extract<FlashcardSource, "ai" | "ai-edited">;
  generationId: NonNullable<FlashcardRow["generation_id"]>;
}

export interface CreateFlashcardsCommand {
  flashcards: (CreateManualFlashcardCommand | CreateAiFlashcardCommand)[];
}

export interface CreateFlashcardsResponse {
  created: FlashcardDto[];
}

export type UpdateFlashcardCommand = Partial<Pick<FlashcardRow, "front" | "back">>;

export interface UpdateFlashcardResponse {
  id: FlashcardRow["id"];
  source: FlashcardSource;
  updatedAt: FlashcardRow["updated_at"];
}

export type DeleteFlashcardResponse = undefined;

// Admin
export interface AdminAppConfigResponse {
  daily_generation_limit: {
    value: AppConfigRow["value"] extends { daily_generation_limit: infer V } ? V : number;
  };
}

// OpenRouter AI Service
export type ChatMessageRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatMessageRole;
  content: string;
}

export interface ModelParams {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
}

export interface ResponseFormat {
  type: "json_schema";
  json_schema: {
    name: string;
    strict: boolean;
    schema: Record<string, unknown>;
  };
}

export interface ChatCompletionInput {
  messages: ChatMessage[];
  model?: string;
  params?: ModelParams;
}

export interface StructuredCompletionInput<T = unknown> extends ChatCompletionInput {
  responseFormat: ResponseFormat;
  validate: (data: unknown) => T;
}

export interface UsageMetadata {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface ChatCompletionOutput {
  text: string;
  usage?: UsageMetadata;
}

export interface StructuredCompletionOutput<T> {
  data: T;
  rawText: string;
  usage?: UsageMetadata;
}

export interface OpenRouterConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel: string;
  timeoutMs?: number;
  appName?: string;
  appUrl?: string;
}

// Flashcards generation through OpenRouter
export interface FlashcardsGenerationDTO {
  flashcards: {
    front: string;
    back: string;
    tags?: string[];
  }[];
}
