import type {
  ChatCompletionInput,
  ChatCompletionOutput,
  ChatMessage,
  OpenRouterConfig,
  StructuredCompletionInput,
  StructuredCompletionOutput,
  UsageMetadata,
} from "../../types";

import {
  OpenRouterConfigError,
  OpenRouterTimeoutError,
  OpenRouterUpstreamError,
  OpenRouterInvalidResponseError,
  OpenRouterInvalidOutputError,
  type OpenRouterResponse,
} from "./openrouter.types";

/**
 * OpenRouterService provides a clean abstraction for interacting with OpenRouter API.
 * It supports both regular chat completions and structured completions with JSON Schema.
 */
export class OpenRouterService {
  private readonly apiKey: string;
  private readonly headersBase: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  public readonly baseUrl: string;
  public readonly defaultModel: string;
  public readonly timeoutMs: number;

  constructor(config: OpenRouterConfig, fetchImpl: typeof fetch = fetch) {
    // Validate configuration with guard clauses
    if (!config.apiKey || config.apiKey.trim().length === 0) {
      throw new OpenRouterConfigError("OPENROUTER_API_KEY is required and cannot be empty.");
    }

    if (!config.defaultModel || config.defaultModel.trim().length === 0) {
      throw new OpenRouterConfigError("defaultModel is required and cannot be empty.");
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://openrouter.ai/api/v1";
    this.defaultModel = config.defaultModel;
    this.timeoutMs = config.timeoutMs ?? 30000;
    this.fetchImpl = fetchImpl;

    // Build base headers
    this.headersBase = this.buildHeaders(config.appName, config.appUrl);
  }

  /**
   * Creates a chat completion without enforced JSON structure.
   */
  async createChatCompletion(input: ChatCompletionInput): Promise<ChatCompletionOutput> {
    // Validate input with guard clauses
    if (!input.messages || input.messages.length === 0) {
      throw new OpenRouterConfigError("At least one message is required.");
    }

    const model = input.model ?? this.defaultModel;

    const payload = {
      model,
      messages: input.messages,
      ...(input.params && {
        temperature: input.params.temperature,
        top_p: input.params.top_p,
        max_tokens: input.params.max_tokens,
      }),
    };

    const response = await this.requestJson<OpenRouterResponse>("/chat/completions", payload);

    const text = this.extractAssistantContent(response);
    const usage = response.usage ? this.mapUsage(response.usage) : undefined;

    return { text, usage };
  }

  /**
   * Creates a structured completion with JSON Schema validation.
   */
  async createStructuredCompletion<T>(input: StructuredCompletionInput<T>): Promise<StructuredCompletionOutput<T>> {
    // Validate input with guard clauses
    if (!input.messages || input.messages.length === 0) {
      throw new OpenRouterConfigError("At least one message is required.");
    }

    if (!input.responseFormat) {
      throw new OpenRouterConfigError("responseFormat is required for structured completion.");
    }

    if (typeof input.validate !== "function") {
      throw new OpenRouterConfigError("validate function is required for structured completion.");
    }

    const model = input.model ?? this.defaultModel;

    const payload = {
      model,
      messages: input.messages,
      response_format: input.responseFormat,
      ...(input.params && {
        temperature: input.params.temperature,
        top_p: input.params.top_p,
        max_tokens: input.params.max_tokens,
      }),
    };

    const response = await this.requestJson<OpenRouterResponse>("/chat/completions", payload);

    const rawText = this.extractAssistantContent(response);
    const usage = response.usage ? this.mapUsage(response.usage) : undefined;

    // Parse and validate JSON
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch (error) {
      throw new OpenRouterInvalidOutputError(
        `Model returned invalid JSON: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    // Validate with provided validator
    let data: T;
    try {
      data = input.validate(parsedJson);
    } catch (error) {
      throw new OpenRouterInvalidOutputError("Model output failed validation.", error);
    }

    return { data, rawText, usage };
  }

  /**
   * Health check to verify configuration and connectivity.
   */
  async healthCheck(): Promise<{ status: "ok" | "error"; message?: string }> {
    try {
      // Simple ping with minimal request
      const testMessages: ChatMessage[] = [{ role: "user", content: "ping" }];

      await this.createChatCompletion({
        messages: testMessages,
        params: { max_tokens: 10, temperature: 0 },
      });

      return { status: "ok" };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error during health check",
      };
    }
  }

  // Private helper methods

  private buildHeaders(appName?: string, appUrl?: string): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    if (appUrl) {
      headers["HTTP-Referer"] = appUrl;
    }

    if (appName) {
      headers["X-Title"] = appName;
    }

    return headers;
  }

  private async requestJson<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method: "POST",
        headers: this.headersBase,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle HTTP errors
      if (!response.ok) {
        await this.handleHttpError(response);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new OpenRouterTimeoutError(`Request timed out after ${this.timeoutMs}ms`);
      }

      if (
        error instanceof OpenRouterUpstreamError ||
        error instanceof OpenRouterTimeoutError ||
        error instanceof OpenRouterInvalidResponseError
      ) {
        throw error;
      }

      throw new OpenRouterUpstreamError(`Network error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async handleHttpError(response: Response): Promise<never> {
    let errorBody: { error?: { message?: string; code?: string } } | null = null;

    try {
      errorBody = await response.json();
    } catch {
      // Ignore JSON parse errors for error body
    }

    const errorMessage = errorBody?.error?.message ?? response.statusText ?? "Unknown error";
    const errorCode = errorBody?.error?.code;

    switch (response.status) {
      case 400:
        throw new OpenRouterUpstreamError(`Bad request: ${errorMessage}`, 400, errorCode);
      case 401:
      case 403:
        throw new OpenRouterUpstreamError(`Authentication error: ${errorMessage}`, response.status, errorCode);
      case 429:
        throw new OpenRouterUpstreamError(`Rate limited: ${errorMessage}`, 429, errorCode);
      case 500:
      case 502:
      case 503:
      case 504:
        throw new OpenRouterUpstreamError(`Upstream server error: ${errorMessage}`, response.status, errorCode);
      default:
        throw new OpenRouterUpstreamError(`HTTP ${response.status}: ${errorMessage}`, response.status, errorCode);
    }
  }

  private extractAssistantContent(response: OpenRouterResponse): string {
    if (!response.choices || response.choices.length === 0) {
      throw new OpenRouterInvalidResponseError("Response does not contain any choices.");
    }

    const firstChoice = response.choices[0];
    if (!firstChoice.message || typeof firstChoice.message.content !== "string") {
      throw new OpenRouterInvalidResponseError("Response choice does not contain valid message content.");
    }

    return firstChoice.message.content;
  }

  private mapUsage(usage: NonNullable<OpenRouterResponse["usage"]>): UsageMetadata {
    return {
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
    };
  }

  /**
   * Safe logging context without sensitive data.
   */
  safeLogContext(ctx: {
    model?: string;
    status?: number;
    durationMs?: number;
    requestId?: string;
  }): Record<string, unknown> {
    return {
      service: "OpenRouter",
      model: ctx.model ?? this.defaultModel,
      ...(ctx.status !== undefined && { status: ctx.status }),
      ...(ctx.durationMs !== undefined && { durationMs: ctx.durationMs }),
      ...(ctx.requestId && { requestId: ctx.requestId }),
    };
  }
}
