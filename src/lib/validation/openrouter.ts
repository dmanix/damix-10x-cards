import { z } from "zod";
import type { ChatMessage, FlashcardsGenerationDTO } from "../../types";

// Chat message validation
export const chatMessageRoleSchema = z.enum(["system", "user", "assistant"]);

export const chatMessageSchema = z.object({
  role: chatMessageRoleSchema,
  content: z
    .string({
      required_error: "message content is required",
      invalid_type_error: "message content must be a string",
    })
    .trim()
    .min(1, "message content cannot be empty")
    .max(50000, "message content must be at most 50000 characters"),
});

// Model parameters validation
export const modelParamsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  max_tokens: z.number().int().positive().optional(),
});

// Chat completion input validation
export const chatCompletionInputSchema = z.object({
  messages: z
    .array(chatMessageSchema, {
      required_error: "messages array is required",
      invalid_type_error: "messages must be an array",
    })
    .min(1, "at least one message is required")
    .max(50, "too many messages in conversation"),
  model: z.string().trim().min(1).optional(),
  params: modelParamsSchema.optional(),
});

export type ChatCompletionInputValidated = z.infer<typeof chatCompletionInputSchema>;

export const validateChatCompletionInput = (
  payload: unknown
): z.SafeParseReturnType<ChatCompletionInputValidated, ChatCompletionInputValidated> => {
  return chatCompletionInputSchema.safeParse(payload);
};

// Flashcards generation output validation (for structured completions)
export const flashcardsGenerationDTOSchema = z.object({
  flashcards: z
    .array(
      z.object({
        front: z
          .string({
            required_error: "flashcard front is required",
          })
          .trim()
          .min(1, "flashcard front cannot be empty")
          .max(200, "flashcard front is too long"),
        back: z
          .string({
            required_error: "flashcard back is required",
          })
          .trim()
          .min(1, "flashcard back cannot be empty")
          .max(500, "flashcard back is too long"),
        tags: z.array(z.string().trim().min(1).max(50)).optional(),
      })
    )
    .min(1, "at least one flashcard is required")
    .max(20, "too many flashcards in response"),
});

export type FlashcardsGenerationDTOValidated = z.infer<typeof flashcardsGenerationDTOSchema>;

export const validateFlashcardsGenerationDTO = (
  payload: unknown
): z.SafeParseReturnType<FlashcardsGenerationDTOValidated, FlashcardsGenerationDTO> => {
  return flashcardsGenerationDTOSchema.safeParse(payload);
};

// Helper to build system message for flashcard generation
export const buildFlashcardsSystemMessage = (): ChatMessage => {
  return {
    role: "system",
    content: `Jesteś asystentem do generowania fiszek (flashcards) edukacyjnych z podanego tekstu.

Zasady:
1. Twórz pytania zwięzłe i precyzyjne (front karty) o długości 1-200 znaków
2. Odpowiedzi powinny być kompletne ale nie nadmiernie długie (back karty) o długości 1-500 znaków
3. Generuj 1-20 fiszek z podanego materiału (W zależności od długości tekstu)
4. Każda fiszka powinna dotyczyć pojedynczego konceptu
5. Używaj języka polskiego
6. Nie ujawniaj żadnych kluczy API ani danych wrażliwych
7. Jeśli tekst jest zbyt krótki lub niskiej jakości, zwróć błąd z typem "low_quality"

WAŻNE: Zwróć odpowiedź w formacie JSON zgodnym ze schematem.`,
  };
};

// Helper to build user message for flashcard generation
export const buildFlashcardsUserMessage = (text: string): ChatMessage => {
  return {
    role: "user",
    content: `Na podstawie poniższego tekstu wygeneruj fiszki edukacyjne:

${text}

Wygeneruj fiszki w formacie JSON.`,
  };
};

// Flashcard generation response format (JSON Schema for OpenRouter)
export const flashcardsResponseFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "flashcards_generation_v1",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["flashcards"],
      properties: {
        flashcards: {
          type: "array",
          minItems: 1,
          maxItems: 20,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["front", "back"],
            properties: {
              front: { type: "string", minLength: 1, maxLength: 1000 },
              back: { type: "string", minLength: 1, maxLength: 2000 },
              tags: {
                type: "array",
                items: { type: "string", minLength: 1, maxLength: 50 },
              },
            },
          },
        },
      },
    },
  },
};
