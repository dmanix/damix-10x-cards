import { z } from "zod";

import type { CreateFlashcardsCommand } from "../../types.ts";

const flashcardBaseSchema = {
  front: z
    .string({
      required_error: "front is required",
      invalid_type_error: "front must be a string",
    })
    .trim()
    .min(1, "front must be at least 1 character")
    .max(200, "front must be at most 200 characters"),
  back: z
    .string({
      required_error: "back is required",
      invalid_type_error: "back must be a string",
    })
    .trim()
    .min(1, "back must be at least 1 character")
    .max(500, "back must be at most 500 characters"),
};

const manualFlashcardSchema = z
  .object({
    ...flashcardBaseSchema,
    source: z.literal("manual"),
    generationId: z.null().optional(),
  })
  .strict();

const aiFlashcardSchema = z
  .object({
    ...flashcardBaseSchema,
    source: z.literal("ai"),
    generationId: z.string().uuid("generationId must be a valid UUID"),
  })
  .strict();

const aiEditedFlashcardSchema = z
  .object({
    ...flashcardBaseSchema,
    source: z.literal("ai-edited"),
    generationId: z.string().uuid("generationId must be a valid UUID"),
  })
  .strict();

export const createFlashcardsSchema = z
  .object({
    flashcards: z
      .array(z.discriminatedUnion("source", [manualFlashcardSchema, aiFlashcardSchema, aiEditedFlashcardSchema]))
      .min(1, "flashcards must contain at least 1 item"),
  })
  .strict();

export type CreateFlashcardsInput = z.infer<typeof createFlashcardsSchema>;

export const validateCreateFlashcardsCommand = (
  payload: unknown
): z.SafeParseReturnType<CreateFlashcardsInput, CreateFlashcardsCommand> => {
  return createFlashcardsSchema.safeParse(payload);
};

export const updateFlashcardPayloadSchema = z
  .object({
    front: z
      .string({
        invalid_type_error: "front must be a string",
      })
      .trim()
      .min(1, "front must be at least 1 character")
      .max(200, "front must be at most 200 characters")
      .optional(),
    back: z
      .string({
        invalid_type_error: "back must be a string",
      })
      .trim()
      .min(1, "back must be at least 1 character")
      .max(500, "back must be at most 500 characters")
      .optional(),
    source: z.union([z.literal("ai"), z.literal("ai-edited"), z.literal("manual")]),
  })
  .refine((value) => value.front ?? value.back, {
    message: "front or back must be provided",
  });
