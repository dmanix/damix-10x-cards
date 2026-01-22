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

export class OpenRouterUpstreamError extends Error {
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

export class OpenRouterInvalidOutputError extends Error {
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
