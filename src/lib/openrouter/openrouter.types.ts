// Custom error types for better error handling
export class OpenRouterConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterConfigError";
  }
}

export class OpenRouterTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterTimeoutError";
  }
}

/**
 * Custom error class for representing errors originating from the upstream OpenRouter API.
 */
export class OpenRouterUpstreamError extends Error {
  /**
   * @param message - The error message.
   * @param status - The HTTP status code, if available.
   * @param code - The OpenRouter API error code, if available.
   */
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "OpenRouterUpstreamError";
  }
}

export class OpenRouterInvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterInvalidResponseError";
  }
}

/**
 * Custom error class for representing errors due to invalid output from the OpenRouter API.
 */
export class OpenRouterInvalidOutputError extends Error {
  /**
   * @param message - The error message.
   * @param validationError - The underlying validation error, if available.
   */
  constructor(
    message: string,
    public readonly validationError?: unknown
  ) {
    super(message);
    this.name = "OpenRouterInvalidOutputError";
  }
}

// OpenRouter API response types
export interface OpenRouterChoice {
  message: {
    role: string;
    content: string;
  };
  finish_reason?: string;
}

/**
 * Represents the structure of a response from the OpenRouter API.
 */
export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: OpenRouterChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}